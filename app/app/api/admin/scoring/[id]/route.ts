import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { validateTables, toConversion } from "@/lib/scoring-profiles";
import { ScoringProfile } from "@/models/Scoring";
import { Test, Attempt } from "@/models/Test";
import { profileInput } from "@/lib/scoring-schemas";

export const dynamic = "force-dynamic";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Scoring profile not found");
  await connectDB();
  const p = await ScoringProfile.findById(id);
  if (!p) throw new HttpError(404, "Scoring profile not found");
  return p;
}

const plain = (p: Awaited<ReturnType<typeof find>>) => {
  const c = toConversion(p);
  return { id: String(p._id), name: p.name, description: p.description ?? "", version: p.version, mode: p.mode, scaledMin: p.scaledMin, scaledMax: p.scaledMax, tables: c.tables, verified: p.verified, source: p.source ?? "", verifiedAt: p.verifiedAt ?? null, isDefault: p.isDefault, status: p.status };
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(plain(await find(params.id)));
  } catch (e) {
    return handleError(e);
  }
}

/** Ubah profil. Bila aturan konversi berubah: versi naik dan status terverifikasi dicabut (harus diverifikasi ulang). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const p = await find(params.id);
    const b = profileInput.parse(await req.json());
    const { errors, warnings } = validateTables(b.mode, b.scaledMin, b.scaledMax, b.tables);
    if (errors.length) throw new HttpError(400, errors[0]);
    if (b.name !== p.name && (await ScoringProfile.exists({ name: b.name, _id: { $ne: p._id } }))) throw new HttpError(409, "A profile with this name already exists");
    const before = JSON.stringify(toConversion(p));
    const next = { mode: b.mode, scaledMin: b.scaledMin, scaledMax: b.scaledMax, tables: b.tables };
    const rulesChanged = before !== JSON.stringify(toConversion({ ...next, tables: next.tables as never } as never));
    p.name = b.name; p.description = b.description;
    p.mode = b.mode; p.scaledMin = b.scaledMin; p.scaledMax = b.scaledMax; p.set("tables", b.tables);
    if (rulesChanged) { p.version += 1; p.verified = false; p.verifiedBy = undefined; p.verifiedAt = undefined; }
    await p.save();
    await audit(admin._id, "scoring.update", params.id, { rulesChanged, version: p.version });
    return NextResponse.json({ ok: true, version: p.version, rulesChanged, verified: p.verified, warnings });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("set_default") }),
  z.object({ action: z.literal("verify"), source: z.string().trim().min(5, "Describe the source (at least 5 characters)").max(300), confirm: z.literal(true, { message: "Confirm that the table matches the source" }) }),
  z.object({ action: z.literal("unverify") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("unarchive") }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const p = await find(params.id);
    const b = action.parse(await req.json());
    if (b.action === "duplicate") {
      let name = `${p.name} (copy)`; let n = 2;
      while (await ScoringProfile.exists({ name })) name = `${p.name} (copy ${n++})`;
      const c = toConversion(p);
      const copy = await ScoringProfile.create({ name, description: p.description, mode: p.mode, scaledMin: p.scaledMin, scaledMax: p.scaledMax, tables: c.tables, verified: false, version: 1 });
      await audit(admin._id, "scoring.duplicate", String(copy._id), { from: params.id });
      return NextResponse.json({ id: String(copy._id) }, { status: 201 });
    }
    if (b.action === "set_default") {
      if (p.status !== "active") throw new HttpError(409, "Archived profiles cannot be the default");
      await ScoringProfile.updateMany({ isDefault: true }, { isDefault: false });
      p.isDefault = true; await p.save();
    } else if (b.action === "verify") {
      const { errors } = validateTables(p.mode, p.scaledMin, p.scaledMax, toConversion(p).tables);
      if (errors.length) throw new HttpError(409, `Fix the table first: ${errors[0]}`);
      if (p.mode === "linear") throw new HttpError(409, "A linear conversion is an estimate and cannot be marked as verified. Use a table from a legitimate source.");
      p.verified = true; p.source = b.source; p.verifiedBy = admin._id; p.verifiedAt = new Date(); await p.save();
    } else if (b.action === "unverify") { p.verified = false; p.verifiedBy = undefined; p.verifiedAt = undefined; await p.save(); }
    else if (b.action === "archive") {
      if (p.isDefault) throw new HttpError(409, "Choose another default profile before archiving this one");
      p.status = "archived"; await p.save();
    } else if (b.action === "unarchive") { p.status = "active"; await p.save(); }
    await audit(admin._id, `scoring.${b.action}`, params.id, b.action === "verify" ? { source: b.source } : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus profil: ditolak bila bawaan, dipilih oleh tes, atau sudah dipakai menilai percobaan (jejak audit tidak boleh putus). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const p = await find(params.id);
    if (p.isDefault) throw new HttpError(409, "The default profile cannot be deleted");
    const [tests, attempts] = await Promise.all([Test.countDocuments({ scoringProfileId: p._id }), Attempt.countDocuments({ scoringProfileId: p._id })]);
    if (tests) throw new HttpError(409, `${tests} test${tests > 1 ? "s use" : " uses"} this profile. Choose another profile in those tests first.`);
    if (attempts) throw new HttpError(409, `${attempts} test result${attempts > 1 ? "s were" : " was"} scored with this profile. Archive it instead of deleting it.`);
    await p.deleteOne();
    await audit(admin._id, "scoring.delete", params.id, { name: p.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

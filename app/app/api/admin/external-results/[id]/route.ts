import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { applyExternalResult, getEquivalence } from "@/lib/clustering";
import { toItp } from "@/lib/score-equivalence";
import { ExternalResult } from "@/models/Cluster";
import { User } from "@/models/User";
import { pdfBucket } from "@/models/Pdf";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Result not found");
  await connectDB();
  const r = await ExternalResult.findById(id);
  if (!r) throw new HttpError(404, "Result not found");
  return r;
}

/** PDF asli untuk dicocokkan admin. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const r = await find(params.id);
    if (!r.fileId) throw new HttpError(404, "This result has no file");
    const stream = (await pdfBucket()).openDownloadStream(r.fileId);
    return new Response(Readable.toWeb(stream) as ReadableStream, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${(r.fileName ?? "result.pdf").replace(/[^\w.\- ]/g, "_")}"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({ userId: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional(), score: z.number().nullable().optional() });

/** Pilih peserta dan/atau koreksi skor (sebelum dikonfirmasi). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const r = await find(params.id);
    if (r.status === "confirmed") throw new HttpError(409, "This result is already confirmed");
    const b = patch.parse(await req.json());
    if (b.userId !== undefined) {
      if (b.userId && !(await User.exists({ _id: b.userId, role: "participant" }))) throw new HttpError(400, "Participant not found");
      r.userId = b.userId ? (b.userId as never) : undefined;
      r.matchConfidence = b.userId ? 1 : 0;
    }
    if (b.score !== undefined) {
      const eq = await getEquivalence();
      const s = eq[r.source as "pure" | "oce"];
      if (b.score !== null && (b.score < s.min || b.score > s.max)) throw new HttpError(400, `${s.name} score must be between ${s.min} and ${s.max}`);
      r.score = b.score ?? undefined;
      r.itpScore = b.score === null ? undefined : toItp(b.score, r.source as "pure" | "oce", eq);
    }
    await r.save();
    return NextResponse.json({ ok: true, itpScore: r.itpScore ?? null });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** confirm: terapkan ke peserta (level, kuota, kelas). skip: abaikan. reopen: kembalikan ke antrean. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const r = await find(params.id);
    const { action } = z.object({ action: z.enum(["confirm", "skip", "reopen"]) }).parse(await req.json());
    if (action === "confirm") {
      if (r.status === "confirmed") throw new HttpError(409, "This result is already confirmed");
      if (!r.userId) throw new HttpError(400, "Choose the participant first");
      return NextResponse.json({ ok: true, ...(await applyExternalResult(r.toObject(), String(r.userId), admin._id)) });
    }
    if (r.status === "confirmed") throw new HttpError(409, "A confirmed result cannot be changed. Upload a new result instead.");
    r.status = action === "skip" ? "skipped" : "pending";
    await r.save();
    await audit(admin._id, `external_result.${action}`, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const r = await find(params.id);
    if (r.status === "confirmed") throw new HttpError(409, "A confirmed result is part of the participant history and cannot be deleted");
    if (r.fileId) await (await pdfBucket()).delete(r.fileId).catch(() => {});
    await r.deleteOne();
    await audit(admin._id, "external_result.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

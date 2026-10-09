import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { handleError, HttpError } from "@/lib/rbac";
import { assertCanWrite, requireAuthor } from "@/lib/material-authz";
import { uniqueSlug } from "@/lib/materials";
import { materialInput, normalizeMaterial } from "@/lib/material-schemas";
import { audit } from "@/lib/audit";
import { Material, MaterialVersion } from "@/models/Material";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Materi tidak ditemukan");
  await connectDB();
  const m = await Material.findById(id);
  if (!m) throw new HttpError(404, "Materi tidak ditemukan");
  return m;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireAuthor();
    const m = await find(params.id);
    assertCanWrite(me, m);
    return NextResponse.json(m.toObject());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuthor();
    const m = await find(params.id);
    assertCanWrite(admin, m);
    const b = normalizeMaterial(materialInput.parse(await req.json()));
    if (admin.role !== "admin" && b.kind !== "rich") throw new HttpError(403, "Materi HTML hanya dikelola admin");
    if (b.title !== m.title) m.slug = await uniqueSlug(b.title, m._id);
    const htmlBefore = JSON.stringify(m.htmlDoc ?? null);
    m.set(b);
    m.editorId = admin._id;
    // Isi HTML yang berubah wajib ditinjau ulang sebelum tampil ke peserta (MTS §10.3).
    const needsReview = m.kind === "html" && m.status !== "draft" && JSON.stringify(m.htmlDoc ?? null) !== htmlBefore;
    if (needsReview) { m.status = "draft"; m.reviewerId = undefined; m.reviewedAt = undefined; }
    await m.save();
    await audit(admin._id, "material.update", params.id, needsReview ? { resetToDraft: true } : undefined);
    return NextResponse.json({ ok: true, slug: m.slug, resetToDraft: needsReview });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuthor();
    const m = await find(params.id);
    assertCanWrite(admin, m);
    await MaterialVersion.deleteMany({ materialId: m._id });
    await m.deleteOne();
    await audit(admin._id, "material.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

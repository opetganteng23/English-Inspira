import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
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
    await requireRole(["admin"]);
    return NextResponse.json((await find(params.id)).toObject());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const m = await find(params.id);
    const b = normalizeMaterial(materialInput.parse(await req.json()));
    if (b.title !== m.title) m.slug = await uniqueSlug(b.title, m._id);
    m.set(b);
    await m.save();
    await audit(admin._id, "material.update", params.id);
    return NextResponse.json({ ok: true, slug: m.slug });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const m = await find(params.id);
    await MaterialVersion.deleteMany({ materialId: m._id });
    await m.deleteOne();
    await audit(admin._id, "material.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { assetUsage } from "@/lib/media";
import { Asset } from "@/models/Asset";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Image not found");
  await connectDB();
  const a = await Asset.findOne({ _id: id, sensitive: false }).select("-dataBase64");
  if (!a) throw new HttpError(404, "Image not found");
  return a;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CONTENT_ROLES);
    const a = await find(params.id);
    const b = z.object({ name: z.string().trim().min(1).max(120) }).parse(await req.json());
    await Asset.updateOne({ _id: a._id }, { name: b.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus gambar hanya bila tidak dipakai di mana pun, supaya soal, materi, dan cover tidak kehilangan gambarnya. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const a = await find(params.id);
    const used = (await assetUsage([a._id])).get(String(a._id)) ?? [];
    if (used.length) throw new HttpError(409, `This image is in use (${used.map((u) => `${u.count} ${u.kind}`).join(", ")}). Remove it from there first.`);
    await Asset.deleteOne({ _id: a._id });
    await audit(admin._id, "media.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

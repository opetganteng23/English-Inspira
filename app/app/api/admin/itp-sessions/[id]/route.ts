import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { sessionInput } from "@/lib/admin-schemas";
import { ItpSession, ItpRegistration } from "@/models/Itp";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Jadwal tidak ditemukan");
  await connectDB();
  const s = await ItpSession.findById(id);
  if (!s) throw new HttpError(404, "Jadwal tidak ditemukan");
  return s;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const s = await find(params.id);
    const b = sessionInput.parse(await req.json());
    if (b.quota < s.registered) throw new HttpError(409, `Kuota tidak boleh di bawah jumlah terdaftar (${s.registered})`);
    s.set(b);
    await s.save();
    await audit(admin._id, "itp.session.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const s = await find(params.id);
    if (await ItpRegistration.exists({ sessionId: s._id, status: { $ne: "cancelled" } })) throw new HttpError(409, "Jadwal sudah punya peserta. Tutup saja, jangan dihapus.");
    await s.deleteOne();
    await audit(admin._id, "itp.session.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

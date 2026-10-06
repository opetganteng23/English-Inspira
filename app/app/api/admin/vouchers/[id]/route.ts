import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { voucherInput } from "@/lib/admin-schemas";
import { Voucher } from "@/models/Commerce";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Voucher tidak ditemukan");
  await connectDB();
  const v = await Voucher.findById(id);
  if (!v) throw new HttpError(404, "Voucher tidak ditemukan");
  return v;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const v = await find(params.id);
    const b = voucherInput.parse(await req.json());
    if (b.code !== v.code && (await Voucher.exists({ code: b.code }))) throw new HttpError(409, "Kode voucher sudah ada");
    if (b.maxUse > 0 && b.maxUse < v.used) throw new HttpError(409, `Batas pakai tidak boleh di bawah yang sudah terpakai (${v.used})`);
    v.set({ ...b, validUntil: b.validUntil ?? undefined });
    await v.save();
    await audit(admin._id, "voucher.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const v = await find(params.id);
    if (v.used > 0) throw new HttpError(409, "Voucher sudah pernah dipakai. Nonaktifkan saja.");
    await v.deleteOne();
    await audit(admin._id, "voucher.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

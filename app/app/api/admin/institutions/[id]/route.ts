import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { institutionInput } from "@/lib/admin-schemas";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institusi tidak ditemukan");
    const b = institutionInput.parse(await req.json());
    await connectDB();
    const i = await Institution.findById(params.id);
    if (!i) throw new HttpError(404, "Institusi tidak ditemukan");
    if (b.code !== i.code && (await Institution.exists({ code: b.code }))) throw new HttpError(409, "Kode institusi sudah dipakai");
    if (b.seats < i.seatsUsed) throw new HttpError(409, `Kursi tidak boleh di bawah yang sudah terpakai (${i.seatsUsed})`);
    i.set({ ...b, productId: b.productId ?? undefined, validUntil: b.validUntil ?? undefined, contactEmail: b.contactEmail || undefined });
    await i.save();
    await audit(admin._id, "institution.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institusi tidak ditemukan");
    await connectDB();
    if (await User.exists({ institutionId: params.id })) throw new HttpError(409, "Institusi sudah punya anggota. Nonaktifkan saja.");
    await Institution.deleteOne({ _id: params.id });
    await audit(admin._id, "institution.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

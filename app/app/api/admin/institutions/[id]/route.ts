import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { institutionInput } from "@/lib/admin-schemas";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { Enrollment } from "@/models/Access";

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
    const endChanged = String(b.contractEnd ?? "") !== String(i.contractEnd ?? "");
    i.set({ ...b, contractStart: b.contractStart ?? undefined, contractEnd: b.contractEnd ?? undefined, contactEmail: b.contactEmail || undefined });
    await i.save();
    // Kontrak diperpanjang/dipersingkat → seluruh enrollment aktif ikut berubah (akses dicek dari enrollment).
    if (endChanged) await Enrollment.updateMany({ institutionId: i._id, status: { $in: ["active", "expired"] } }, { expiresAt: b.contractEnd ?? undefined, status: !b.contractEnd || b.contractEnd > new Date() ? "active" : "expired" });
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

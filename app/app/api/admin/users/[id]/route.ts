import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { userPatchInput } from "@/lib/admin-schemas";
import { disableMember, enableMember } from "@/lib/participants";
import { User } from "@/models/User";

/** Ubah nama / aktifkan-nonaktifkan akun internal. Menonaktifkan tidak menghapus riwayat (MTS §8). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Pengguna tidak ditemukan");
    const b = userPatchInput.parse(await req.json());
    await connectDB();
    const u = await User.findById(params.id);
    if (!u) throw new HttpError(404, "Pengguna tidak ditemukan");

    if (b.status === "disabled" && u.role === "admin") {
      if (String(u._id) === String(admin._id)) throw new HttpError(409, "Kamu tidak bisa menonaktifkan akunmu sendiri");
      if ((await User.countDocuments({ role: "admin", status: { $ne: "disabled" }, _id: { $ne: u._id } })) === 0) throw new HttpError(409, "Harus ada minimal satu admin aktif");
    }
    if (b.name !== undefined) { u.name = b.name; await u.save(); }
    if (b.status === "disabled") await disableMember(u._id);
    if (b.status === "active" && u.status === "disabled") await enableMember(u._id);
    await audit(admin._id, "user.update", params.id, b);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

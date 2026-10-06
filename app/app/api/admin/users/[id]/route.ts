import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { userPatchInput } from "@/lib/admin-schemas";
import { User } from "@/models/User";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Pengguna tidak ditemukan");
    const b = userPatchInput.parse(await req.json());
    await connectDB();
    const u = await User.findById(params.id);
    if (!u) throw new HttpError(404, "Pengguna tidak ditemukan");

    // Jangan sampai tidak ada admin aktif tersisa, dan jangan menurunkan/menonaktifkan diri sendiri.
    const demoting = u.role === "admin" && ((b.role && b.role !== "admin") || b.status === "suspended");
    if (demoting) {
      if (String(u._id) === String(admin._id)) throw new HttpError(409, "Kamu tidak bisa menurunkan atau menonaktifkan akunmu sendiri");
      const others = await User.countDocuments({ role: "admin", status: "active", _id: { $ne: u._id } });
      if (others === 0) throw new HttpError(409, "Harus ada minimal satu admin aktif");
    }
    const role = b.role ?? u.role;
    const inst = b.institutionId === undefined ? u.institutionId : b.institutionId ?? undefined;
    if (role === "inst_admin" && !inst) throw new HttpError(400, "Admin institusi wajib dihubungkan ke institusi");
    u.set({ ...(b.name !== undefined ? { name: b.name } : {}), role, status: b.status ?? u.status, institutionId: inst });
    await u.save();
    await audit(admin._id, "user.update", params.id, b);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

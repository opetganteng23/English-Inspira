import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { userCreateInput } from "@/lib/admin-schemas";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

/** Akun internal (admin & admin institusi). Peserta dikelola di menu Peserta. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [users, insts] = await Promise.all([User.find({ role: { $in: ["admin", "inst_admin"] } }).sort({ createdAt: -1 }).lean(), Institution.find().select("name").lean()]);
    const name = new Map(insts.map((i) => [String(i._id), i.name]));
    return NextResponse.json({ users: users.map((u) => ({ id: String(u._id), name: u.name ?? null, email: u.email, role: u.role, status: u.status, institution: u.institutionId ? name.get(String(u.institutionId)) ?? null : null, institutionId: u.institutionId ? String(u.institutionId) : null, createdAt: u.createdAt })) });
  } catch (e) {
    return handleError(e);
  }
}

/** Buat/angkat akun: pengguna masuk sendiri lewat OTP email. */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = userCreateInput.parse(await req.json());
    if (b.role === "inst_admin" && !b.institutionId) throw new HttpError(400, "Admin institusi wajib dihubungkan ke institusi");
    await connectDB();
    if (b.institutionId && !(await Institution.exists({ _id: b.institutionId }))) throw new HttpError(404, "Institusi tidak ditemukan");
    const email = b.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== "participant") throw new HttpError(409, "Email sudah terdaftar sebagai akun internal");
      existing.set({ role: b.role, institutionId: b.institutionId ?? undefined, ...(b.name ? { name: b.name } : {}) });
      await existing.save();
      await audit(admin._id, "user.promote", String(existing._id), { role: b.role });
      return NextResponse.json({ id: String(existing._id), promoted: true });
    }
    const u = await User.create({ email, name: b.name, role: b.role, institutionId: b.institutionId ?? undefined });
    await audit(admin._id, "user.create", String(u._id), { role: b.role });
    return NextResponse.json({ id: String(u._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

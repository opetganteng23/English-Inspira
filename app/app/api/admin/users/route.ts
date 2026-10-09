import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { userCreateInput } from "@/lib/admin-schemas";
import { createMember } from "@/lib/participants";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

/** Akun internal: admin, admin institusi, coach. Peserta dikelola di menu Peserta. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [users, insts] = await Promise.all([User.find({ role: { $in: ["admin", "inst_admin", "coach"] } }).sort({ createdAt: -1 }).lean(), Institution.find().select("name").lean()]);
    const name = new Map(insts.map((i) => [String(i._id), i.name]));
    return NextResponse.json({
      users: users.map((u) => ({ id: String(u._id), name: u.name ?? null, email: u.email, role: u.role, status: u.status, institution: u.institutionId ? name.get(String(u.institutionId)) ?? null : null, institutionId: u.institutionId ? String(u.institutionId) : null, lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Buat akun internal. Coach & admin institusi WAJIB punya institusi (satu coach melayani satu institusi) dan diundang lewat email;
 * admin pusat tanpa institusi dan langsung aktif (masuk dengan OTP ke email ini).
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = userCreateInput.parse(await req.json());
    await connectDB();
    if (b.role === "admin") {
      const email = b.email.toLowerCase();
      if (await User.exists({ email })) throw new HttpError(409, "Email sudah terdaftar");
      const u = await User.create({ email, name: b.name, role: "admin", status: "active", consentAt: new Date() });
      await audit(admin._id, "user.create", String(u._id), { role: "admin" });
      return NextResponse.json({ id: String(u._id) }, { status: 201 });
    }
    if (!b.institutionId) throw new HttpError(400, "Coach dan admin institusi wajib dihubungkan ke institusi");
    const out = await createMember(b.institutionId, { email: b.email, name: b.name, role: b.role }, admin._id);
    await audit(admin._id, "user.create", String(out.userId), { role: b.role, resent: out.resent });
    return NextResponse.json({ id: String(out.userId), resent: out.resent }, { status: out.resent ? 200 : 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

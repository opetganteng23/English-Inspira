import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { userCreateInput } from "@/lib/admin-schemas";
import { createMember, issueStaffInvitation } from "@/lib/participants";
import { splitName } from "@/lib/person-name";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

/** Akun internal: admin, admin institusi, coach. Peserta dikelola di menu Peserta. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [users, insts] = await Promise.all([User.find({ role: { $in: ["admin", "academic_admin", "content_editor", "inst_admin", "coach"] }, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).lean(), Institution.find().select("name").lean()]);
    const name = new Map(insts.map((i) => [String(i._id), i.name]));
    return NextResponse.json({
      users: users.map((u) => ({ id: String(u._id), name: u.name ?? null, givenName: u.givenName ?? splitName(u.name).givenName, surname: u.surname ?? splitName(u.name).surname, phone: u.phone ?? "", email: u.email, role: u.role, status: u.status, institution: u.institutionId ? name.get(String(u.institutionId)) ?? null : null, institutionId: u.institutionId ? String(u.institutionId) : null, lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt })),
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
    if (b.role === "admin" || b.role === "academic_admin" || b.role === "content_editor") {
      const email = b.email.toLowerCase();
      if (await User.exists({ email })) throw new HttpError(409, "Email already registered");
      const u = await User.create({ email, name: b.name, role: b.role, status: "active", consentAt: new Date() });
      await audit(admin._id, "user.create", String(u._id), { role: b.role });
      await issueStaffInvitation({ _id: u._id, email: u.email, name: u.name, role: b.role }, admin._id);
      return NextResponse.json({ id: String(u._id), invited: true }, { status: 201 });
    }
    if (!b.institutionId) throw new HttpError(400, "Coaches and institution admins must be linked to an institution");
    const out = await createMember(b.institutionId, { email: b.email, name: b.name, role: b.role }, admin._id);
    await audit(admin._id, "user.create", String(out.userId), { role: b.role, resent: out.resent });
    return NextResponse.json({ id: String(out.userId), resent: out.resent }, { status: out.resent ? 200 : 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

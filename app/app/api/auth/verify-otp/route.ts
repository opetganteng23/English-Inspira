import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { consumeCode, CODE_BAD as BAD } from "@/lib/otp-code";
import { User } from "@/models/User";
import { Invitation } from "@/models/Access";
import { createSession } from "@/lib/auth";
import { hasActiveEnrollment } from "@/lib/access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { sha256 } from "@/lib/participants";

const schema = z.object({ email: z.email().max(200), code: z.string().regex(/^\d{6}$/), invite: z.string().max(100).optional() });
const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();
    await limit("verifyIp", clientIp(req));
    await connectDB();

    await consumeCode(email, body.code);

    let user = await User.findOne({ email });
    if (!user) {
      // Tidak ada pendaftaran publik: satu-satunya akun baru yang boleh lahir di sini adalah admin pertama dari ADMIN_EMAILS.
      if (!adminEmails().includes(email)) throw new HttpError(400, BAD);
      user = await User.create({ email, role: "admin", status: "active", consentAt: new Date() });
    }
    if (user.status === "disabled") throw new HttpError(403, "Account deactivated");
    if (user.role !== "admin" && !(await hasActiveEnrollment(user._id))) throw new HttpError(403, "Your access has ended. Contact your institution.");

    if (body.invite) await Invitation.updateOne({ tokenHash: sha256(body.invite), userId: user._id, status: "pending" }, { status: "used" });
    user.lastLoginAt = new Date();
    user.emailVerifiedAt ??= new Date();
    await user.save();
    // Password yang diisi saat daftar tetapi belum diverifikasi bisa jadi dibuat orang lain: dibuang.
    await User.updateOne({ _id: user._id }, { $unset: { pendingPasswordHash: 1 } });

    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, needsConsent: user.status === "invited" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

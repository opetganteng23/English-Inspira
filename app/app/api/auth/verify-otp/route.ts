import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Otp } from "@/models/Otp";
import { User } from "@/models/User";
import { Invitation } from "@/models/Access";
import { createSession } from "@/lib/auth";
import { hasActiveEnrollment } from "@/lib/access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { sha256 } from "@/lib/participants";

const MAX_ATTEMPTS = 5;
const schema = z.object({ email: z.email().max(200), code: z.string().regex(/^\d{6}$/), invite: z.string().max(100).optional() });
const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const BAD = "Kode kedaluwarsa atau terkunci. Minta kode baru.";

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();
    await limit("verifyIp", clientIp(req));
    await connectDB();

    // Naikkan percobaan secara atomik sebelum membandingkan, agar tidak bisa dibalap paralel.
    const otp = await Otp.findOneAndUpdate(
      { email, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!otp) throw new HttpError(400, BAD);
    if (!(await bcrypt.compare(body.code, otp.codeHash))) {
      const left = MAX_ATTEMPTS - otp.attempts;
      throw new HttpError(400, left > 0 ? `Kode salah. Sisa percobaan: ${left}` : "Kode terkunci. Minta kode baru.");
    }
    await Otp.deleteMany({ email }); // sekali pakai

    let user = await User.findOne({ email });
    if (!user) {
      // Tidak ada pendaftaran publik: satu-satunya akun baru yang boleh lahir di sini adalah admin pertama dari ADMIN_EMAILS.
      if (!adminEmails().includes(email)) throw new HttpError(400, BAD);
      user = await User.create({ email, role: "admin", status: "active", consentAt: new Date() });
    }
    if (user.status === "disabled") throw new HttpError(403, "Akun dinonaktifkan");
    if (user.role !== "admin" && !(await hasActiveEnrollment(user._id))) throw new HttpError(403, "Akses sudah berakhir. Hubungi institusimu.");

    if (body.invite) await Invitation.updateOne({ tokenHash: sha256(body.invite), userId: user._id, status: "pending" }, { status: "used" });
    user.lastLoginAt = new Date();
    await user.save();

    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, needsConsent: user.status === "invited" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

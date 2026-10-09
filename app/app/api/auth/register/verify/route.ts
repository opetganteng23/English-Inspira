import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Enrollment } from "@/models/Access";
import { createSession } from "@/lib/auth";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { activeInstitution } from "@/lib/participants";
import { consumeCode, CODE_BAD } from "@/lib/otp-code";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.email().max(200), code: z.string().regex(/^\d{6}$/) });

/** Verifikasi email pendaftar: ambil kursi secara atomik, buat enrollment, aktifkan password, lalu masuk (lanjut ke persetujuan data). */
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    const email = b.email.toLowerCase().trim();
    await limit("verifyIp", clientIp(req));
    await connectDB();
    await consumeCode(email, b.code);
    const user = await User.findOne({ email, selfRegistered: true, emailVerifiedAt: null }).select("+pendingPasswordHash");
    if (!user || !user.institutionId || !user.pendingPasswordHash) throw new HttpError(400, CODE_BAD);
    const inst = await activeInstitution(user.institutionId);
    const seat = await Institution.findOneAndUpdate({ _id: inst._id, $expr: { $lt: ["$seatsUsed", "$seats"] } }, { $inc: { seatsUsed: 1 } });
    if (!seat) throw new HttpError(409, "This institution has no seats left. Contact your institution.");
    try {
      await Enrollment.create({ userId: user._id, institutionId: inst._id, startsAt: inst.contractStart && inst.contractStart > new Date() ? inst.contractStart : new Date(), expiresAt: inst.contractEnd });
    } catch (e) {
      await Institution.updateOne({ _id: inst._id }, { $inc: { seatsUsed: -1 } });
      throw e;
    }
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: user.pendingPasswordHash, emailVerifiedAt: new Date(), lastLoginAt: new Date() }, $unset: { pendingPasswordHash: 1 } });
    await audit(user._id, "auth.register", String(inst._id));
    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, needsConsent: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
    return handleError(e);
  }
}

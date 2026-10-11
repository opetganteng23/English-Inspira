import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { limit, clientIp } from "@/lib/ratelimit";
import { issueCode, consumeCode } from "@/lib/otp-code";
import { enqueueMail } from "@/lib/mailq";
import { emailSchema } from "@/lib/participants";
import { ItpRegistration } from "@/models/Itp";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

const requestInput = z.object({ newEmail: emailSchema });
const confirmInput = z.object({ newEmail: emailSchema, code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Not signed in");
  if (u.status === "invited") throw new HttpError(403, "Complete the data consent first", "consent_required");
  return u;
}

/** Langkah 1: kirim kode 6 digit ke email BARU untuk membuktikan kepemilikannya. Email lama tetap berlaku sampai dikonfirmasi. */
export async function POST(req: Request) {
  try {
    const u = await me();
    const { newEmail } = requestInput.parse(await req.json());
    const email = newEmail.toLowerCase().trim();
    if (email === u.email) throw new HttpError(400, "That is already your email");
    await limit("otpEmail", `chg:${u._id}`);
    await limit("otpIp", clientIp(req));
    await connectDB();
    // Tidak mengirim kode ke email yang sudah terdaftar (kode itu akan menimpa kode masuk milik pemiliknya).
    if (await User.exists({ email })) throw new HttpError(409, "This email is already used by another account");
    await issueCode(email, "change_email");
    return NextResponse.json({ ok: true, expiresInSec: 300 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Langkah 2: konfirmasi kode. Email berganti, sesi tetap berlaku, dan email lama diberi pemberitahuan keamanan. */
export async function PUT(req: Request) {
  try {
    const u = await me();
    const { newEmail, code } = confirmInput.parse(await req.json());
    const email = newEmail.toLowerCase().trim();
    await limit("verifyIp", clientIp(req));
    await connectDB();
    if (await ItpRegistration.exists({ userId: u._id, status: { $in: ["submitted", "confirmed"] } }))
      throw new HttpError(409, "Your email cannot be changed while an official ITP registration is active. Contact your institution.");
    await consumeCode(email, code);
    const old = u.email;
    try {
      await User.updateOne({ _id: u._id }, { $set: { email, emailVerifiedAt: new Date() } });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new HttpError(409, "This email is already used by another account");
      throw e;
    }
    await audit(u._id, "user.email_change", String(u._id), { from: old, to: email });
    await enqueueMail(old, "email_changed", { newEmail: email }, { priority: 1 });
    return NextResponse.json({ ok: true, email });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

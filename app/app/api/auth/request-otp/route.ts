import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { connectDB } from "@/lib/db";
import { Otp } from "@/models/Otp";
import { sendMail, otpEmail } from "@/lib/mailer";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";

const schema = z.object({ email: z.email().max(200) });

export async function POST(req: Request) {
  try {
    const { email: raw } = schema.parse(await req.json());
    const email = raw.toLowerCase().trim();
    await limit("otpIp", clientIp(req));
    await limit("otpEmail", email);
    await connectDB();

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await Otp.deleteMany({ email }); // hanya satu kode aktif per email
    await Otp.create({
      email,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    // Tidak memblokir request; kegagalan kirim dicatat saja.
    void sendMail(email, "Kode masuk Edulyfe EPTA", otpEmail(code)).catch((e) =>
      console.error("[mail] gagal kirim OTP", e)
    );
    // Respons sama untuk email baru maupun lama (tidak membocorkan keberadaan akun).
    return NextResponse.json({ ok: true, expiresInSec: 300 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { connectDB } from "@/lib/db";
import { Otp } from "@/models/Otp";
import { User } from "@/models/User";
import { enqueueMail } from "@/lib/mailq";
import { hasActiveEnrollment } from "@/lib/access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";

const schema = z.object({ email: z.email().max(200) });
const adminBootstrap = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Kode HANYA dikirim ke email yang sudah terdaftar (invited/active + enrollment berlaku; admin tanpa enrollment).
 * Respons SELALU sama untuk email dikenal maupun tidak, supaya daftar peserta tidak bisa ditebak.
 */
export async function POST(req: Request) {
  try {
    const { email: raw } = schema.parse(await req.json());
    const email = raw.toLowerCase().trim();
    await limit("otpIp", clientIp(req));
    await limit("otpEmail", email);
    await connectDB();

    const user = await User.findOne({ email }).lean();
    const eligible = user
      ? user.status !== "disabled" && (user.role === "admin" || (await hasActiveEnrollment(user._id)))
      : adminBootstrap().includes(email); // admin pertama dari ADMIN_EMAILS

    if (eligible) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await Otp.deleteMany({ email }); // hanya satu kode aktif per email
      await Otp.create({ email, codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + 5 * 60_000) });
      await enqueueMail(email, "otp", { code });
    }
    return NextResponse.json({ ok: true, expiresInSec: 300 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    return handleError(e);
  }
}

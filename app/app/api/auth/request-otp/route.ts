import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { issueCode } from "@/lib/otp-code";
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

    if (eligible) await issueCode(email, "otp");
    return NextResponse.json({ ok: true, expiresInSec: 300 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    return handleError(e);
  }
}

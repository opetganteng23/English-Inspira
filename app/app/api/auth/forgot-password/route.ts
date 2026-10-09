import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { hasActiveEnrollment } from "@/lib/access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";
import { enqueueMail } from "@/lib/mailq";
import { sha256 } from "@/lib/participants";

const schema = z.object({ email: z.email().max(200) });

/** Kirim tautan reset (30 menit, sekali pakai) ke akun yang aktif. Respons selalu sama. */
export async function POST(req: Request) {
  try {
    const email = schema.parse(await req.json()).email.toLowerCase().trim();
    await limit("resetIp", clientIp(req));
    await limit("resetEmail", email);
    await connectDB();
    const user = await User.findOne({ email }).lean();
    const eligible = user && user.status !== "disabled" && (user.role === "admin" || (await hasActiveEnrollment(user._id)));
    if (eligible) {
      const token = randomBytes(32).toString("hex");
      await User.updateOne({ _id: user._id }, { resetTokenHash: sha256(token), resetExpiresAt: new Date(Date.now() + 30 * 60_000) });
      await enqueueMail(email, "password_reset", { link: `${process.env.APP_URL ?? new URL(req.url).origin}/reset-password?token=${token}` }, { priority: 1 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    return handleError(e);
  }
}

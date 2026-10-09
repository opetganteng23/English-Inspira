import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth";
import { hasActiveEnrollment } from "@/lib/access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { checkPassword } from "@/lib/password";

const schema = z.object({ email: z.email().max(200), password: z.string().min(1).max(128), adminOnly: z.boolean().optional() });
const WRONG = "Wrong email or password. Never set a password? Sign in with an email code or use Forgot password.";

/** Login email + password. Pesan salah selalu sama agar keberadaan akun tidak bisa ditebak. */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();
    await limit("loginIp", clientIp(req));
    await limit("loginEmail", email);
    await connectDB();
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!(await checkPassword(body.password, user?.passwordHash)) || !user || !user.emailVerifiedAt) throw new HttpError(400, WRONG);
    if (body.adminOnly && user.role !== "admin") throw new HttpError(403, "This sign-in page is for admins only. Use the regular sign-in page.");
    if (user.status === "disabled") throw new HttpError(403, "Account deactivated");
    if (user.role !== "admin" && !(await hasActiveEnrollment(user._id))) throw new HttpError(403, "Your access has ended. Contact your institution.");
    user.lastLoginAt = new Date();
    await user.save();
    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, needsConsent: user.status === "invited" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
    return handleError(e);
  }
}

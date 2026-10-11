import { NextResponse } from "next/server";
import { isCentralStaff } from "@/lib/role-home";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth";
import { hasActiveEnrollment, accessDeniedMessage } from "@/lib/access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { checkPassword } from "@/lib/password";
import { verifyCaptcha } from "@/lib/captcha";

const schema = z.object({ email: z.email().max(200), password: z.string().min(1).max(128), adminOnly: z.boolean().optional(), captcha: z.unknown().optional() });
const WRONG = "Wrong email or password. Invited but never set a password? Open the link in your invitation email, or use Forgot password.";

/** Login email + password. Pesan salah selalu sama agar keberadaan akun tidak bisa ditebak. */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();
    const ip = clientIp(req);
    await limit("loginIp", ip);
    await verifyCaptcha(body.captcha, ip);
    await limit("loginEmail", email);
    await connectDB();
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!(await checkPassword(body.password, user?.passwordHash)) || !user) throw new HttpError(400, WRONG);
    if (body.adminOnly && !isCentralStaff(user.role)) throw new HttpError(403, "This sign-in page is for admins only. Use the regular sign-in page.");
    if (user.status === "disabled") throw new HttpError(403, "Account deactivated");
    if (!isCentralStaff(user.role) && !(await hasActiveEnrollment(user._id))) throw new HttpError(403, await accessDeniedMessage(user._id));
    user.lastLoginAt = new Date();
    await user.save();
    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, needsConsent: user.status === "invited" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
    return handleError(e);
  }
}

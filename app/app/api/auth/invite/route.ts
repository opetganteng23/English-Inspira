import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Invitation } from "@/models/Access";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { sha256 } from "@/lib/participants";
import { hashPassword, passwordSchema } from "@/lib/password";
import { verifyCaptcha } from "@/lib/captcha";
import { createSession } from "@/lib/auth";
import { hasActiveEnrollment, accessDeniedMessage } from "@/lib/access";
import { isCentralStaff } from "@/lib/role-home";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const INVALID = "The invitation is invalid or has expired. Ask your admin to send a new one.";
async function findInvite(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) throw new HttpError(404, INVALID);
  await connectDB();
  const inv = await Invitation.findOne({ tokenHash: sha256(token), status: "pending", expiresAt: { $gt: new Date() } });
  if (!inv) throw new HttpError(404, INVALID);
  return inv;
}

/** Tautan undangan: tampilkan email dan institusi di halaman "buat password". */
export async function GET(req: Request) {
  try {
    await limit("verifyIp", clientIp(req));
    const inv = await findInvite(new URL(req.url).searchParams.get("token") ?? "");
    const inst = await Institution.findById(inv.institutionId).select("name").lean();
    return NextResponse.json({ email: inv.email, institution: inst?.name ?? null });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({ token: z.string(), password: passwordSchema, captcha: z.unknown().optional() });

/** Terima undangan: tautan dari email membuktikan pemilik email, jadi peserta cukup membuat password lalu masuk. */
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    const ip = clientIp(req);
    await limit("verifyIp", ip);
    await verifyCaptcha(b.captcha, ip);
    const inv = await findInvite(b.token);
    const user = await User.findOne({ email: inv.email, deletedAt: { $exists: false } });
    if (!user || user.status === "disabled") throw new HttpError(404, INVALID);
    if (!isCentralStaff(user.role) && !(await hasActiveEnrollment(user._id))) throw new HttpError(403, await accessDeniedMessage(user._id));
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(b.password), emailVerifiedAt: user.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() } });
    await Invitation.updateOne({ _id: inv._id }, { status: "used" });
    await audit(user._id, "auth.invite_accepted", String(inv._id));
    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, needsConsent: user.status === "invited" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

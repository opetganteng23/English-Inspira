import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { sha256 } from "@/lib/participants";
import { hashPassword, passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

const schema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/, "This reset link is invalid"), password: passwordSchema });

/** Set password baru dari tautan reset. Tautan membuktikan kepemilikan email. */
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    await limit("verifyIp", clientIp(req));
    await connectDB();
    const user = await User.findOneAndUpdate(
      { resetTokenHash: sha256(b.token), resetExpiresAt: { $gt: new Date() } },
      { $set: { passwordHash: await hashPassword(b.password) }, $unset: { resetTokenHash: 1, resetExpiresAt: 1, pendingPasswordHash: 1 } },
      { new: true }
    );
    if (!user) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
    if (!user.emailVerifiedAt) await User.updateOne({ _id: user._id }, { emailVerifiedAt: new Date() });
    await audit(user._id, "auth.password_reset", String(user._id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

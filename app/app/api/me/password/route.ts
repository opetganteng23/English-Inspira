import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { User } from "@/models/User";
import { limit } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { checkPassword, hashPassword, passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

const schema = z.object({ current: z.string().max(128).optional(), password: passwordSchema });

/** Set atau ganti password sendiri. Bila sudah punya password, password lama wajib benar. */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, "Not signed in");
    const b = schema.parse(await req.json());
    await limit("loginEmail", me.email);
    await connectDB();
    const u = await User.findById(me._id).select("+passwordHash");
    if (!u) throw new HttpError(401, "Not signed in");
    if (u.passwordHash && !(await checkPassword(b.current ?? "", u.passwordHash))) throw new HttpError(400, "Your current password is wrong");
    await User.updateOne({ _id: u._id }, { $set: { passwordHash: await hashPassword(b.password), emailVerifiedAt: u.emailVerifiedAt ?? new Date() } });
    await audit(u._id, "auth.password_change", String(u._id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

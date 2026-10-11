import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Enrollment } from "@/models/Access";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { activeInstitution } from "@/lib/participants";
import { hashPassword, passwordSchema } from "@/lib/password";
import { composeName } from "@/lib/person-name";
import { verifyCaptcha } from "@/lib/captcha";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  givenName: z.string().trim().min(1, "Enter your given name").max(60),
  surname: z.string().trim().min(1, "Enter your surname").max(60),
  email: z.email("Invalid email").max(200),
  password: passwordSchema,
  code: z.string().trim().min(3, "Enter your institution code").max(20).transform((s) => s.toUpperCase()),
  captcha: z.unknown().optional(),
});

/**
 * Daftar dengan kode institusi + pemeriksaan keamanan (captcha), tanpa kode email.
 * Akun langsung dibuat, kursi institusi diambil atomik, lalu peserta masuk dan diarahkan ke persetujuan data.
 */
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    const email = b.email.toLowerCase().trim();
    const ip = clientIp(req);
    await limit("registerIp", ip);
    await verifyCaptcha(b.captcha, ip);
    await connectDB();
    const found = await Institution.findOne({ code: b.code }).select("_id").lean();
    if (!found) throw new HttpError(400, "Institution code not found. Check the code with your institution.");
    const inst = await activeInstitution(found._id);

    // Pendaftar lama yang belum pernah menyelesaikan verifikasi email (alur lama) boleh mendaftar ulang.
    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing && !(existing.selfRegistered && !existing.passwordHash)) throw new HttpError(409, "This email already has an account. Sign in, or use Forgot password if you do not remember the password.");

    const seat = await Institution.findOneAndUpdate({ _id: inst._id, $expr: { $lt: ["$seatsUsed", "$seats"] } }, { $inc: { seatsUsed: 1 } });
    if (!seat) throw new HttpError(409, "This institution has no seats left. Contact your institution.");
    let userId;
    try {
      const fields = { name: composeName(b.givenName, b.surname), givenName: b.givenName, surname: b.surname, role: "participant" as const, institutionId: inst._id, status: "invited" as const, selfRegistered: true, passwordHash: await hashPassword(b.password), lastLoginAt: new Date() };
      if (existing) { await User.updateOne({ _id: existing._id }, { $set: fields, $unset: { pendingPasswordHash: 1 } }); userId = existing._id; }
      else userId = (await User.create({ email, ...fields }))._id;
      await Enrollment.create({ userId, institutionId: inst._id, startsAt: inst.contractStart && inst.contractStart > new Date() ? inst.contractStart : new Date(), expiresAt: inst.contractEnd });
    } catch (e) {
      await Institution.updateOne({ _id: inst._id }, { $inc: { seatsUsed: -1 } });
      if (userId && !existing) await User.deleteOne({ _id: userId });
      throw e;
    }
    await audit(userId, "auth.register", String(inst._id));
    await createSession(String(userId), "participant");
    return NextResponse.json({ ok: true, role: "participant", needsConsent: true }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

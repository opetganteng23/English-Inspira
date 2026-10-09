import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";
import { activeInstitution } from "@/lib/participants";
import { hashPassword, passwordSchema } from "@/lib/password";
import { issueCode } from "@/lib/otp-code";
import { enqueueMail } from "@/lib/mailq";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.email("Invalid email").max(200),
  password: passwordSchema,
  code: z.string().trim().min(3, "Enter your institution code").max(20).transform((s) => s.toUpperCase()),
});

/**
 * Daftar dengan kode institusi. Akun baru belum aktif: kode 6 digit dikirim ke email, kursi diambil saat verifikasi.
 * Email yang sudah punya akun mendapat respons yang sama (tidak membocorkan keberadaan akun) dan email "akun sudah ada".
 */
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    const email = b.email.toLowerCase().trim();
    await limit("registerIp", clientIp(req));
    await limit("otpEmail", email);
    await connectDB();
    const inst = await Institution.findOne({ code: b.code }).select("_id seats seatsUsed").lean();
    if (!inst) throw new HttpError(400, "Institution code not found. Check the code with your institution.");
    await activeInstitution(inst._id);
    if ((inst.seatsUsed ?? 0) >= (inst.seats ?? 0)) throw new HttpError(409, "This institution has no seats left. Contact your institution.");

    const existing = await User.findOne({ email });
    if (existing && !(existing.selfRegistered && !existing.emailVerifiedAt)) {
      await enqueueMail(email, "account_exists", { link: `${process.env.APP_URL ?? new URL(req.url).origin}/sign-in` });
      return NextResponse.json({ ok: true, expiresInSec: 300 });
    }
    const pendingPasswordHash = await hashPassword(b.password);
    if (existing) await User.updateOne({ _id: existing._id }, { name: b.name, institutionId: inst._id, pendingPasswordHash });
    else await User.create({ email, name: b.name, role: "participant", institutionId: inst._id, status: "invited", selfRegistered: true, pendingPasswordHash });
    await issueCode(email, "verify_email");
    return NextResponse.json({ ok: true, expiresInSec: 300 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

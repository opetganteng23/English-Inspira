import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Otp } from "@/models/Otp";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError, HttpError } from "@/lib/rbac";

const MAX_ATTEMPTS = 5;
const schema = z.object({
  email: z.email().max(200),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(1).max(100).optional(), // diisi saat pendaftaran
});

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();
    await limit("verifyIp", clientIp(req));
    await connectDB();

    // Naikkan percobaan secara atomik sebelum membandingkan, agar tidak bisa dibalap paralel.
    const otp = await Otp.findOneAndUpdate(
      { email, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!otp) throw new HttpError(400, "Kode kedaluwarsa atau terkunci. Minta kode baru.");

    if (!(await bcrypt.compare(body.code, otp.codeHash))) {
      const left = MAX_ATTEMPTS - otp.attempts;
      throw new HttpError(400, left > 0 ? `Kode salah. Sisa percobaan: ${left}` : "Kode terkunci. Minta kode baru.");
    }
    await Otp.deleteMany({ email }); // sekali pakai

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: body.name,
        role: adminEmails().includes(email) ? "admin" : "participant",
      });
    } else if (user.status !== "active") {
      throw new HttpError(403, "Akun dinonaktifkan");
    } else if (!user.name && body.name) {
      user.name = body.name;
      await user.save();
    }

    await createSession(String(user._id), user.role);
    return NextResponse.json({ ok: true, role: user.role, isNew: !user.name });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

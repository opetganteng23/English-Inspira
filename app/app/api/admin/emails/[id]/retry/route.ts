import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { kick } from "@/lib/mailq";
import { MailJob } from "@/models/Access";

/** Kirim ulang email yang gagal. Kode OTP tidak dikirim ulang (sudah kedaluwarsa; pengguna meminta kode baru). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Email not found");
    await connectDB();
    const m = await MailJob.findById(params.id);
    if (!m) throw new HttpError(404, "Email not found");
    if (m.template === "otp" || m.template === "password_reset") throw new HttpError(409, "Sign-in codes and reset links expire. Ask the person to request a new one.");
    if (m.status !== "failed") throw new HttpError(409, "Only failed emails can be resent.");
    m.status = "queued"; m.tries = 0; m.nextTryAt = new Date(); m.lastError = undefined;
    await m.save();
    await audit(admin._id, "email.retry", params.id, { to: m.to, template: m.template });
    kick();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

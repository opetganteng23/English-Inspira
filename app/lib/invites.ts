import { z } from "zod";
import { HttpError } from "./rbac";
import { sendMail, inviteEmail } from "./mailer";
import { audit } from "./orders";
import { Institution } from "@/models/Institution";
import type { Types } from "mongoose";

export const inviteInput = z.object({ emails: z.array(z.email()).min(1, "Isi minimal satu email").max(100, "Maksimal 100 email per kirim") });

/**
 * Kirim undangan (kode institusi) ke daftar email. Pengiriman massal lewat Gmail dibatasi ±500/hari,
 * jadi dikirim berurutan dan hasilnya dilaporkan per alamat. Untuk volume besar ganti SMTP lewat MAIL_*.
 */
export async function sendInvites(institutionId: Types.ObjectId | string, emails: string[], actorId: Types.ObjectId | string) {
  const inst = await Institution.findById(institutionId).lean();
  if (!inst) throw new HttpError(404, "Institusi tidak ditemukan");
  if (!inst.active) throw new HttpError(409, "Institusi tidak aktif");
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/masuk`;
  const unique = Array.from(new Set(emails.map((e) => e.toLowerCase())));
  const results: { email: string; ok: boolean }[] = [];
  for (const email of unique) {
    try { await sendMail(email, `Undangan program TOEFL ITP dari ${inst.name}`, inviteEmail(inst.name, inst.code, link)); results.push({ email, ok: true }); }
    catch { results.push({ email, ok: false }); }
  }
  await audit(actorId, "institution.invite", String(institutionId), { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
  return results;
}

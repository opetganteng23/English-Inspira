import { connectDB } from "./db";
import { processMailQueue } from "./mailq";
import { expireEnrollments } from "./access";
import { MailJob, Invitation } from "@/models/Access";
import { Otp } from "@/models/Otp";
import { expirePlanItems } from "./study-plan";
import { sendSessionReminders } from "./coaching";
import { retryFallbackAnalyses } from "./analysis";

// Job terjadwal (MTS §18). Dipanggil oleh instrumentation.ts (node-cron, PM2) atau /api/cron/[job] (cron sistem/Vercel).
// Job berikutnya (reminder sesi, status plan, peringatan kuota) ditambahkan di sini pada Fase 5–6.

/** Tiap menit: kirim email di antrean (retry bertahap, batas undangan per jam). */
export async function mailJob() {
  return processMailQueue(50);
}

/** Per jam: pengingat sesi coaching H-1, dan ulangi narasi AI yang jatuh ke template. */
export async function hourlyJob() {
  return { reminders: await sendSessionReminders(), analysis: await retryFallbackAnalyses() };
}

/** Harian: akhiri enrollment yang kontraknya habis, bersihkan undangan/email lama. */
export async function dailyJob() {
  await connectDB();
  const expired = await expireEnrollments();
  const old = new Date(Date.now() - 30 * 86_400_000);
  const mails = await MailJob.deleteMany({ status: { $in: ["sent", "failed"] }, updatedAt: { $lt: old } });
  const invs = await Invitation.deleteMany({ status: { $ne: "pending" }, updatedAt: { $lt: old } });
  await Otp.deleteMany({ expiresAt: { $lt: new Date() } }); // TTL juga membersihkan; ini cadangan
  const planExpired = await expirePlanItems();
  return { enrollmentsExpired: expired, planExpired, mailsPurged: mails.deletedCount, invitationsPurged: invs.deletedCount };
}

export const JOBS = { mail: mailJob, hourly: hourlyJob, daily: dailyJob } as const;
export type JobName = keyof typeof JOBS;

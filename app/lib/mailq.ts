import { connectDB } from "./db";
import { User } from "@/models/User";
import { getParam } from "./config";
import { sendMail } from "./mailer";
import { render, type TemplateName } from "./mail-templates";
import { MailJob } from "@/models/Access";

const BACKOFF_MIN = [1, 5, 15, 60, 240]; // percobaan ulang bertahap
// Undangan massal (peserta baru dan jadwal tes) dibatasi per jam dan per hari; OTP dan email transaksional tidak.
const THROTTLED = ["invitation", "test_invitation", "test_reschedule", "test_reminder"];
const MAX_TRIES = BACKOFF_MIN.length;

/** Masukkan email ke antrean. OTP berprioritas tertinggi. Tidak pernah memblokir request. */
// Template opsional mengikuti preferensi penerima; semua template lain (OTP, reset, undangan, jadwal, pendaftaran ITP) selalu dikirim.
const OPTIONAL: Partial<Record<TemplateName, "reminders" | "progress">> = { plan_deadline: "reminders", quota_low: "reminders", session_reminder: "reminders", level_up: "progress", placement_result: "progress", analysis_ready: "progress" };

export async function enqueueMail(to: string, template: TemplateName, data: Record<string, unknown> = {}, opts: { priority?: number; delayMs?: number } = {}) {
  await connectDB();
  const pref = OPTIONAL[template];
  if (pref) {
    const u = await User.findOne({ email: to.toLowerCase() }).select("emailPrefs").lean();
    if (u?.emailPrefs && u.emailPrefs[pref] === false) return;
  }
  await MailJob.create({ to, template, data, priority: opts.priority ?? (template === "otp" ? 1 : 5), nextTryAt: new Date(Date.now() + (opts.delayMs ?? 0)) });
  kick(); // di dev/tanpa cron, langsung diproses di latar
}

let running = false;
/** Proses antrean di latar (debounce). Aman dipanggil berulang. */
export function kick(limit = 60) {
  if (running) return;
  running = true;
  processMailQueue(limit).catch((e) => console.error("[mailq]", e)).finally(() => { running = false; });
}

/** Ambil dan kirim email yang jatuh tempo. Undangan dibatasi per jam (Gmail ±500/hari). */
export async function processMailQueue(limit = 20) {
  await connectDB();
  // Kembalikan pekerjaan yang macet di 'sending' > 5 menit (proses mati di tengah jalan).
  await MailJob.updateMany({ status: "sending", updatedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }, { status: "queued" });

  const cap = await getParam("invite_hourly_cap");
  const sentInvites = await MailJob.countDocuments({ template: { $in: THROTTLED }, status: "sent", sentAt: { $gte: new Date(Date.now() - 3_600_000) } });
  // Batas harian dihitung dari SEMUA email keluar (Gmail membatasi total), tetapi hanya undangan massal yang berhenti saat habis.
  const dailyCap = await getParam("mail_daily_cap");
  const sentToday = await MailJob.countDocuments({ status: "sent", sentAt: { $gte: new Date(Date.now() - 86_400_000) } });
  let inviteBudget = Math.max(0, Math.min(cap - sentInvites, dailyCap - sentToday));

  let sent = 0, failed = 0, deferred = 0, taken = 0;
  // 3 pekerja paralel (sama dengan maxConnections pool SMTP): 100 kode OTP serentak selesai dalam hitungan detik, bukan menit.
  const worker = async () => {
    while (taken < limit) {
      taken++;
      // Klaim atomik: dua pekerja/proses tidak mengirim email yang sama dua kali.
      const job = await MailJob.findOneAndUpdate(
        { status: "queued", nextTryAt: { $lte: new Date() }, ...(inviteBudget <= 0 ? { template: { $nin: THROTTLED } } : {}) },
        { status: "sending" }, { sort: { priority: 1, nextTryAt: 1 }, returnDocument: "after" }
      );
      if (!job) return;
      try {
        const { subject, html } = render(job.template as TemplateName, (job.data ?? {}) as Record<string, unknown>);
        await sendMail(job.to, subject, html);
        job.status = "sent"; job.sentAt = new Date(); job.lastError = undefined;
        if (THROTTLED.includes(job.template)) inviteBudget--;
        sent++;
      } catch (e) {
        job.tries += 1; job.lastError = (e as Error).message.slice(0, 300);
        if (job.tries >= MAX_TRIES) { job.status = "failed"; failed++; }
        else { job.status = "queued"; job.nextTryAt = new Date(Date.now() + BACKOFF_MIN[job.tries - 1] * 60_000); deferred++; }
      }
      await job.save();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { sent, failed, deferred };
}

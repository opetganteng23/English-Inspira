import { connectDB } from "./db";
import { getParam } from "./config";
import { sendMail } from "./mailer";
import { render, type TemplateName } from "./mail-templates";
import { MailJob } from "@/models/Access";

const BACKOFF_MIN = [1, 5, 15, 60, 240]; // percobaan ulang bertahap
const MAX_TRIES = BACKOFF_MIN.length;

/** Masukkan email ke antrean. OTP berprioritas tertinggi. Tidak pernah memblokir request. */
export async function enqueueMail(to: string, template: TemplateName, data: Record<string, unknown> = {}, opts: { priority?: number; delayMs?: number } = {}) {
  await connectDB();
  await MailJob.create({ to, template, data, priority: opts.priority ?? (template === "otp" ? 1 : 5), nextTryAt: new Date(Date.now() + (opts.delayMs ?? 0)) });
  kick(); // di dev/tanpa cron, langsung diproses di latar
}

let running = false;
/** Proses antrean di latar (debounce). Aman dipanggil berulang. */
export function kick(limit = 20) {
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
  const sentInvites = await MailJob.countDocuments({ template: "invitation", status: "sent", sentAt: { $gte: new Date(Date.now() - 3_600_000) } });
  let inviteBudget = Math.max(0, cap - sentInvites);

  let sent = 0, failed = 0, deferred = 0;
  for (let i = 0; i < limit; i++) {
    // Klaim atomik: dua proses tidak mengirim email yang sama dua kali.
    const job = await MailJob.findOneAndUpdate(
      { status: "queued", nextTryAt: { $lte: new Date() }, ...(inviteBudget <= 0 ? { template: { $ne: "invitation" } } : {}) },
      { status: "sending" }, { sort: { priority: 1, nextTryAt: 1 }, new: true }
    );
    if (!job) break;
    try {
      const { subject, html } = render(job.template as TemplateName, (job.data ?? {}) as Record<string, unknown>);
      await sendMail(job.to, subject, html);
      job.status = "sent"; job.sentAt = new Date(); job.lastError = undefined;
      if (job.template === "invitation") inviteBudget--;
      sent++;
    } catch (e) {
      job.tries += 1; job.lastError = (e as Error).message.slice(0, 300);
      if (job.tries >= MAX_TRIES) { job.status = "failed"; failed++; }
      else { job.status = "queued"; job.nextTryAt = new Date(Date.now() + BACKOFF_MIN[job.tries - 1] * 60_000); deferred++; }
    }
    await job.save();
  }
  return { sent, failed, deferred };
}

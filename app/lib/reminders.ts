import { connectDB } from "./db";
import { enqueueMail } from "./mailq";
import { notify, notifyAdmins } from "./notify";
import { coachingMonitor } from "./coaching-monitor";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { CoachingQuota } from "@/models/Config";
import { PlanItem } from "@/models/Learning";

const APP = () => process.env.APP_URL ?? "http://localhost:3000";
const DAY = 86_400_000;

/** H-2 deadline study plan (MTS §18): satu email + satu notifikasi per peserta per hari, sekali per item. */
export async function planDeadlineReminders() {
  await connectDB();
  const items = await PlanItem.find({ status: "active", remindedAt: { $exists: false }, dueAt: { $gt: new Date(), $lte: new Date(Date.now() + 2 * DAY) } });
  const byUser = new Map<string, typeof items>();
  for (const i of items) byUser.set(String(i.userId), [...(byUser.get(String(i.userId)) ?? []), i]);
  let sent = 0;
  for (const [uid, list] of byUser) {
    const u = await User.findOne({ _id: uid, status: "active" }).select("email").lean();
    if (!u) continue;
    // Klaim atomik per item agar job yang berjalan ganda tidak mengirim dua kali.
    const claimed = [];
    for (const i of list) if ((await PlanItem.updateOne({ _id: i._id, remindedAt: { $exists: false } }, { remindedAt: new Date() })).modifiedCount) claimed.push(i);
    if (!claimed.length) continue;
    await enqueueMail(u.email, "plan_deadline", { items: claimed.map((i) => i.title), link: `${APP()}/beranda` });
    await notify(u._id, "plan_deadline", { title: "Study plan deadline approaching", body: claimed.map((i) => i.title).join("; ").slice(0, 200), href: "/beranda" });
    sent++;
  }
  return sent;
}

/**
 * Peringatan kuota (MTS §18): (a) peserta yang sisa kuota coachingnya ≤ 1, sekali per kuota;
 * (b) admin diberi tahu bila kuota institusi tidak mungkin habis sebelum kontrak berakhir (sekali per institusi per minggu).
 */
export async function quotaWarnings() {
  await connectDB();
  let low = 0;
  const quotas = await CoachingQuota.find({ active: true, lowWarnedAt: { $exists: false }, $expr: { $and: [{ $gt: ["$total", 0] }, { $lte: [{ $subtract: ["$total", "$used"] }, 1] }] } }).limit(500);
  for (const q of quotas) {
    const u = await User.findOne({ _id: q.userId, status: "active" }).select("email").lean();
    if (!u) continue;
    if (!(await CoachingQuota.updateOne({ _id: q._id, lowWarnedAt: { $exists: false } }, { lowWarnedAt: new Date() })).modifiedCount) continue;
    await enqueueMail(u.email, "quota_low", { left: Math.max(0, q.total - q.used) });
    await notify(u._id, "quota_low", { title: "Coaching quota almost used up", body: `${Math.max(0, q.total - q.used)} sessions left.`, href: "/coaching" });
    low++;
  }
  let unreachable = 0;
  const week = new Date().toISOString().slice(0, 4) + "-W" + Math.floor(Date.now() / (7 * DAY));
  for (const i of await coachingMonitor()) {
    if (!i.warnings.length) continue;
    await notifyAdmins("coaching_warning", { title: `Coaching ${i.name}: needs action`, body: i.warnings.join(" "), href: "/admin/coaching" }, `${i.id}:${week}`);
    unreachable++;
  }
  return { low, institutionsWarned: unreachable };
}

/** Kontrak institusi berakhir 30/14/7 hari lagi: email kontak institusi + notifikasi admin, sekali per ambang. */
export async function contractWarnings() {
  await connectDB();
  const now = Date.now();
  let n = 0;
  for (const inst of await Institution.find({ status: "active", contractEnd: { $gt: new Date(now), $lte: new Date(now + 30 * DAY) } })) {
    const days = Math.ceil((+inst.contractEnd! - now) / DAY);
    const t = [7, 14, 30].find((x) => days <= x);
    if (!t || (inst.contractWarned ?? []).includes(t)) continue;
    const claimed = await Institution.updateOne({ _id: inst._id, contractWarned: { $ne: t } }, { $addToSet: { contractWarned: t } });
    if (!claimed.modifiedCount) continue;
    if (inst.contactEmail) await enqueueMail(inst.contactEmail, "contract_expiring", { name: inst.name, days, date: inst.contractEnd });
    await notifyAdmins("contract_expiring", { title: `${inst.name} contract ends in ${days} days`, href: "/admin/institusi" }, `${inst._id}:${t}`);
    n++;
  }
  return n;
}

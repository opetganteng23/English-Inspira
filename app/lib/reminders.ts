import { connectDB } from "./db";
import { sendMail, reminderEmail } from "./mailer";
import { CounselorThread } from "@/models/Counselor";
import { User } from "@/models/User";

/** Kirim pengingat rencana aksi (email). Satu email per peserta; tiap butir paling sering sekali per 6 hari. */
export async function sendWeeklyReminders(now = new Date()) {
  await connectDB();
  const cutoff = new Date(now.getTime() - 6 * 86_400_000);
  const threads = await CounselorThread.find({ "actionPlan.done": false });
  const byUser = new Map<string, { texts: string[]; threads: typeof threads }>();
  for (const t of threads) {
    const due = t.actionPlan.filter((p) => !p.done && (!p.remindedAt || p.remindedAt < cutoff));
    if (!due.length) continue;
    const k = String(t.userId);
    const g = byUser.get(k) ?? { texts: [], threads: [] };
    g.texts.push(...due.map((p) => p.text ?? ""));
    g.threads.push(t);
    byUser.set(k, g);
  }
  let sent = 0;
  for (const [userId, g] of Array.from(byUser.entries())) {
    const u = await User.findById(userId).select("email name status").lean();
    if (!u || u.status !== "active") continue;
    try {
      await sendMail(u.email, "Rencana aksi mingguanmu", reminderEmail(u.name ?? "peserta", g.texts.slice(0, 8)));
      for (const t of g.threads) {
        t.actionPlan.forEach((p) => { if (!p.done && (!p.remindedAt || p.remindedAt < cutoff)) p.remindedAt = now; });
        await t.save();
      }
      sent++;
    } catch (e) {
      console.error("[reminder] gagal kirim ke", u.email, e); // gagal satu penerima tidak menghentikan yang lain
    }
  }
  return { users: byUser.size, sent };
}

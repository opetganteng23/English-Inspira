// Penjadwal dalam-proses untuk VPS/Docker (satu instance). Di Vercel pakai Vercel Cron (vercel.json).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.ENABLE_INPROCESS_CRON !== "true") return;
  const cron = (await import("node-cron")).default;
  const { sendWeeklyReminders } = await import("./lib/reminders");
  // Senin 08:00 WIB
  cron.schedule("0 8 * * 1", () => { sendWeeklyReminders().catch((e) => console.error("[cron] reminders", e)); }, { timezone: "Asia/Jakarta" });
  console.log("[cron] pengingat mingguan aktif (Senin 08:00 WIB)");
}

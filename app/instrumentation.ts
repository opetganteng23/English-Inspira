// Penjadwal dalam-proses untuk VPS/PM2 (SATU instance). Di Vercel pakai Vercel Cron (vercel.json) atau cron sistem
// yang memanggil /api/cron/{mail|hourly|daily} dengan CRON_SECRET.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.ENABLE_INPROCESS_CRON !== "true") return;
  const cron = (await import("node-cron")).default;
  const { JOBS } = await import("./lib/jobs");
  const run = (name: keyof typeof JOBS) => () => { JOBS[name]().catch((e) => console.error(`[cron] ${name}`, e)); };
  cron.schedule("* * * * *", run("mail"));
  cron.schedule("0 * * * *", run("hourly"), { timezone: "Asia/Jakarta" });
  cron.schedule("0 1 * * *", run("daily"), { timezone: "Asia/Jakarta" });
  console.log("[cron] aktif: mail (tiap menit), hourly, daily 01:00 WIB");
}

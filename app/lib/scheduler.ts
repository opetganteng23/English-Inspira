import cron from "node-cron";
import { JOBS } from "./jobs";

/** Jadwalkan job (MTS §18) di dalam proses. Hanya bila ENABLE_INPROCESS_CRON=true; PM2 wajib satu instance. */
export async function startScheduler() {
  if (process.env.ENABLE_INPROCESS_CRON !== "true") return;
  const run = (name: keyof typeof JOBS) => () => { JOBS[name]().catch((e) => console.error(`[cron] ${name}`, e)); };
  cron.schedule("* * * * *", run("mail"));
  cron.schedule("0 * * * *", run("hourly"), { timezone: "Asia/Jakarta" });
  cron.schedule("0 1 * * *", run("daily"), { timezone: "Asia/Jakarta" });
  console.log("[cron] active: mail (every minute), hourly, daily 01:00 WIB");
}

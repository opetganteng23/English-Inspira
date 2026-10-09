// Penjadwal dalam-proses untuk VPS/PM2 (SATU instance). Alternatifnya cron sistem
// yang memanggil /api/cron/{mail|hourly|daily} dengan CRON_SECRET.
// Kondisi NEXT_RUNTIME harus berada langsung di `if` agar webpack membuang impor Node dari bundel edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    await startScheduler();
  }
}

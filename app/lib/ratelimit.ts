import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { HttpError } from "./rbac";

// In-memory: cukup untuk satu instance. Ganti ke RateLimiterMongo/Redis bila scale-out.
// Batas PER IP sengaja longgar: satu kampus/kantor biasanya keluar lewat SATU IP publik (NAT), dan puluhan peserta
// bisa masuk bersamaan saat tes serentak. Perlindungan utama tetap per email (otpEmail, loginEmail, resetEmail)
// dan per kode OTP (maks 5 percobaan di database, lib/otp-code.ts). Dapat diubah lewat env RATE_IP_FACTOR (kelipatan).
const F = Math.max(1, Number(process.env.RATE_IP_FACTOR) || 1);
const limiters = {
  otpEmail: new RateLimiterMemory({ points: 3, duration: 600 }),
  otpIp: new RateLimiterMemory({ points: 300 * F, duration: 3600 }),
  verifyIp: new RateLimiterMemory({ points: 600 * F, duration: 600 }),
  loginIp: new RateLimiterMemory({ points: 600 * F, duration: 600 }),
  loginEmail: new RateLimiterMemory({ points: 10, duration: 900 }),
  registerIp: new RateLimiterMemory({ points: 150 * F, duration: 3600 }),
  resetIp: new RateLimiterMemory({ points: 100 * F, duration: 3600 }),
  resetEmail: new RateLimiterMemory({ points: 3, duration: 900 }),
};

export async function limit(name: keyof typeof limiters, key: string) {
  try {
    await limiters[name].consume(key);
  } catch (e) {
    if (e instanceof RateLimiterRes) {
      const min = Math.max(1, Math.ceil(e.msBeforeNext / 60000));
      if (name === "loginEmail") throw new HttpError(429, `Too many wrong passwords for this account. Try again in ${min} minute${min === 1 ? "" : "s"}, or reset your password to unlock it now. Tip: type the password yourself instead of using the browser's saved one.`);
      throw new HttpError(429, `Too many attempts, please try again in ${min} minute${min === 1 ? "" : "s"}`);
    }
    throw e;
  }
}

/** Hapus hitungan batas untuk satu kunci (mis. setelah password berhasil direset: kunci login email dibuka). */
export async function clearLimit(name: keyof typeof limiters, key: string) {
  await limiters[name].delete(key).catch(() => {});
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

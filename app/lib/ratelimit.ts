import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { HttpError } from "./rbac";

// In-memory: cukup untuk satu instance. Ganti ke RateLimiterMongo/Redis bila scale-out.
const limiters = {
  otpEmail: new RateLimiterMemory({ points: 3, duration: 600 }),
  otpIp: new RateLimiterMemory({ points: 10, duration: 3600 }),
  verifyIp: new RateLimiterMemory({ points: 30, duration: 600 }),
};

export async function limit(name: keyof typeof limiters, key: string) {
  try {
    await limiters[name].consume(key);
  } catch (e) {
    if (e instanceof RateLimiterRes) throw new HttpError(429, "Too many attempts, please try again later");
    throw e;
  }
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { HttpError } from "./rbac";
import { GLYPHS } from "./captcha-glyphs";

// Pemeriksaan keamanan (captcha) untuk masuk, daftar, buat password, dan lupa password.
// Bila TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY terpasang, dipakai Cloudflare Turnstile.
// Tanpa kunci itu, dipakai captcha bawaan: gambar SVG berisi 5 karakter, token bertanda tangan HMAC, berlaku 10 menit, sekali pakai.

const CHARS = "ACDEFHJKMNPRTWXY3479"; // tanpa karakter yang mudah tertukar (0/O/Q, 1/I/L, 2/Z, 5/S, 6/G, 8/B, U/V)
const TTL = 10 * 60_000;
const used = new Map<string, number>(); // nonce yang sudah dipakai → kedaluwarsa

const secret = () => process.env.JWT_SECRET || "dev-captcha-secret";
const sign = (s: string) => createHmac("sha256", secret()).update(s).digest("base64url");
export const turnstileKeys = () => (process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? { site: process.env.TURNSTILE_SITE_KEY, secret: process.env.TURNSTILE_SECRET_KEY } : null);

function svgFor(text: string) {
  const w = 170, h = 56;
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  // Gangguan tipis dan pucat, digambar DI BELAKANG huruf supaya tidak menutupi bentuknya.
  const noise = Array.from({ length: 3 }, () => `<path d="M${randomInt(0, w)} ${randomInt(0, h)} Q${randomInt(0, w)} ${randomInt(0, h)} ${randomInt(0, w)} ${randomInt(0, h)}" stroke="#${["8FA6C8", "B7C4D9", "D4BE6A"][randomInt(0, 3)]}" stroke-width="1" fill="none" opacity="0.5"/>`).join("");
  const dots = Array.from({ length: 18 }, () => `<circle cx="${randomInt(0, w)}" cy="${randomInt(0, h)}" r="${randomInt(1, 2)}" fill="#B7C4D9" opacity="0.5"/>`).join("");
  // Setiap huruf: goresan dengan skala, kemiringan, rotasi, dan getaran titik acak, dalam sel selebar 31 px agar tidak bertumpuk.
  const letters = [...text].map((c, i) => {
    const sx = r(1.7, 1.95), sy = r(2.2, 2.45), rot = r(-0.14, 0.14), skew = r(-0.08, 0.08);
    const ox = 12 + i * 31 + r(-1.5, 1.5), oy = 12 + r(-3, 3);
    const pt = ([x, y]: [number, number]) => {
      const X = (x + r(-0.3, 0.3)) * sx + (y * skew), Y = (y + r(-0.3, 0.3)) * sy;
      return `${(ox + X * Math.cos(rot) - Y * Math.sin(rot)).toFixed(1)} ${(oy + X * Math.sin(rot) + Y * Math.cos(rot)).toFixed(1)}`;
    };
    return GLYPHS[c].map((line) => `<path d="M${line.map(pt).join(" L")}" stroke="#0A2257" stroke-width="${r(2.8, 3.2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`).join("");
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#EEF3FA"/>${dots}${noise}${letters}</svg>`;
}

/** Tantangan baru untuk captcha bawaan. Jawaban tidak disimpan di server; hanya tanda tangannya. */
export function createChallenge() {
  const { token, svg } = challengeWithAnswer();
  return { token, svg };
}
/** Internal (dipakai unit test): tantangan beserta jawabannya. Jangan pernah dikirim ke klien. */
export function challengeWithAnswer() {
  const answer = Array.from({ length: 5 }, () => CHARS[randomInt(0, CHARS.length)]).join("");
  const payload = `${Date.now() + TTL}.${randomBytes(9).toString("base64url")}`;
  return { token: `${payload}.${sign(`${payload}.${answer}`)}`, svg: svgFor(answer), answer };
}

const fail = () => new HttpError(400, "The security check failed. Please try again.", "captcha");
const missing = () => new HttpError(400, "Complete the security check first.", "captcha");

/** Wajib dipanggil sebelum memproses masuk/daftar. `input` = { turnstile } atau { token, answer }. */
export async function verifyCaptcha(input: unknown, ip?: string) {
  if (input == null) throw missing();
  const v = input as { turnstile?: unknown; token?: unknown; answer?: unknown };
  const ts = turnstileKeys();
  if (ts) {
    if (typeof v.turnstile !== "string" || !v.turnstile) throw fail();
    const body = new URLSearchParams({ secret: ts.secret, response: v.turnstile, ...(ip && ip !== "local" ? { remoteip: ip } : {}) });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) }).then((x) => x.json()).catch(() => null);
    if (!r?.success) throw fail();
    return;
  }
  if (process.env.CAPTCHA_TEST_MODE === "1" && v.answer === "TEST1") return; // hanya untuk uji otomatis di server lokal
  if (typeof v.token !== "string" || typeof v.answer !== "string") throw fail();
  const parts = v.token.split(".");
  if (parts.length !== 3) throw fail();
  const [exp, nonce, sig] = parts;
  if (!(Number(exp) > Date.now())) throw new HttpError(400, "The security check expired. Load a new one.", "captcha");
  const want = Buffer.from(sign(`${exp}.${nonce}.${v.answer.trim().toUpperCase()}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw fail();
  if (used.has(nonce)) throw fail();
  used.set(nonce, Number(exp));
  if (used.size > 5000) for (const [k, t] of used) if (t < Date.now()) used.delete(k);
}

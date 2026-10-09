import { z } from "zod";

// Validasi pesan dari iframe materi (sisi induk). Pesan salah bentuk, bernonce salah, atau berukuran berlebih diabaikan.
const MAX_ANSWERS_BYTES = 20_000;
const base = z.object({ v: z.literal(1), n: z.string() });
const score = z.number().finite().min(0).max(100);
const msg = z.discriminatedUnion("t", [
  base.extend({ t: z.literal("height"), p: z.object({ h: z.number().finite().min(0).max(100_000) }) }),
  base.extend({ t: z.literal("report"), p: z.object({ score, answers: z.unknown().optional() }) }),
  base.extend({ t: z.literal("complete"), p: z.object({ score, answers: z.unknown().optional() }) }),
]);

export type BridgeMessage =
  | { type: "height"; h: number }
  | { type: "report" | "complete"; score: number; answers: unknown };

export function parseBridgeMessage(data: unknown, nonce: string): BridgeMessage | null {
  const r = msg.safeParse(data);
  if (!r.success || r.data.n !== nonce) return null;
  const m = r.data;
  if (m.t === "height") return { type: "height", h: m.p.h };
  let size = 0;
  try { size = JSON.stringify(m.p.answers ?? null).length; } catch { return null; }
  if (size > MAX_ANSWERS_BYTES) return null;
  return { type: m.t, score: m.p.score, answers: m.p.answers ?? null };
}

/** Pembatas frekuensi sederhana: jeda minimal antar pesan report/complete dan batas total per pemuatan. */
export function makeRateGate(minGapMs = 500, maxTotal = 30, now: () => number = Date.now) {
  let last = 0, total = 0;
  return () => {
    const t = now();
    if (total >= maxTotal || t - last < minGapMs) return false;
    last = t; total++;
    return true;
  };
}

export function newNonce() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Live screen view: SATU gambar terakhir per percobaan, hanya di memori proses server (PM2 fork, satu proses).
 * Tidak pernah ditulis ke database, disk, atau log. Gambar dibuang setelah STALE_MS tanpa kiriman baru,
 * atau saat tes selesai. Restart server mengosongkan semuanya.
 */
export type ScreenState = "shared" | "stopped" | "unsupported" | "denied";
type Entry = { img: Buffer | null; at: number; state: ScreenState; testId: string; userId: string; institutionId: string };

export const STALE_MS = 90_000;
const g = globalThis as unknown as { __screens?: Map<string, Entry> };
const store: Map<string, Entry> = (g.__screens ??= new Map());

function sweep(now = Date.now()) { for (const [k, e] of store) if (now - e.at > STALE_MS) store.delete(k); }

export function putScreen(attemptId: string, e: Omit<Entry, "at">) {
  const prev = store.get(attemptId);
  // status tanpa gambar (mis. "stopped") tidak menghapus gambar terakhir sebelum kedaluwarsa
  store.set(attemptId, { ...e, img: e.img ?? (e.state === "shared" ? prev?.img ?? null : null), at: Date.now() });
  if (store.size % 50 === 0) sweep();
}
export function dropScreen(attemptId: string) { store.delete(attemptId); }

export function getScreen(attemptId: string) {
  const e = store.get(attemptId);
  if (!e) return null;
  if (Date.now() - e.at > STALE_MS) { store.delete(attemptId); return null; }
  return e;
}

/** Status layar semua percobaan satu tes (tanpa gambar), opsional satu institusi. */
export function screenStates(testId: string, institutionId?: string) {
  sweep();
  const out: Record<string, { state: ScreenState; at: number; hasImg: boolean }> = {};
  for (const [k, e] of store) if (e.testId === testId && (!institutionId || e.institutionId === institutionId)) out[k] = { state: e.state, at: e.at, hasImg: !!e.img };
  return out;
}

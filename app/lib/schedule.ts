import type { Types } from "mongoose";

export type Window = { opensAt: Date; closesAt: Date };
export type SeatState = "upcoming" | "open" | "closed";

export function windowState(w: Window, now = new Date()): SeatState {
  return now < w.opensAt ? "upcoming" : now > w.closesAt ? "closed" : "open";
}

/** Jendela efektif satu kursi: perpanjangan per peserta menggantikan jendela sesi. */
export function effectiveWindow(session: Window, override?: { opensAt?: Date | null; closesAt?: Date | null } | null): Window {
  return { opensAt: override?.opensAt ?? session.opensAt, closesAt: override?.closesAt ?? session.closesAt };
}

export type GateResult = { visible: boolean; ok: boolean; reason?: string; window?: Window; state?: SeatState; label?: string };

const WIB = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
export const fmtWib = WIB;

/**
 * Aturan akses tes terjadwal untuk peserta.
 * - Tes tidak terjadwal: tidak ada pembatasan di sini.
 * - Admin dan QA tester: dikecualikan.
 * - Tanpa kursi: tes tidak terlihat sama sekali.
 * - Dengan kursi: terlihat; hanya bisa dimulai di dalam jendela efektif.
 */
export function scheduleGate(test: { scheduled?: boolean | null }, user: { role: string; qaTester?: boolean | null }, seat: { window: Window; label?: string } | null, now = new Date()): GateResult {
  if (!test.scheduled || user.role === "admin" || user.qaTester) return { visible: true, ok: true };
  if (!seat) return { visible: false, ok: false, reason: "This test is not scheduled for you." };
  const state = windowState(seat.window, now);
  const base = { visible: true, window: seat.window, state, label: seat.label };
  if (state === "upcoming") return { ...base, ok: false, reason: `Opens on ${WIB(seat.window.opensAt)}.` };
  if (state === "closed") return { ...base, ok: false, reason: `Your session closed on ${WIB(seat.window.closesAt)}. Contact the administrator if you could not attend.` };
  return { ...base, ok: true };
}

export type Slot = { id: string; capacity: number; filled: number };
export type SpreadMode = "random" | "sequential" | "balanced";
export type Person = { id: string; group?: string | null };

function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(items: T[], seed: string): T[] {
  const r = seeded(seed), a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Sebar peserta ke slot tanpa melewati kuota.
 * - random: acak (seed tetap), lalu bagi bergilir ke slot yang masih punya ruang, sehingga slot terisi seimbang.
 * - sequential: isi slot pertama sampai penuh, lalu berikutnya; urutan orang mengikuti masukan (tanpa acak).
 * - balanced: kelompokkan per `group` (mis. instansi), acak di dalam kelompok, lalu bagi bergilir sehingga tiap slot berisi campuran proporsional.
 * Mengembalikan penempatan dan daftar yang tidak kebagian (kuota habis). Hasil sama untuk masukan dan seed yang sama.
 */
export function spread(people: Person[], slots: Slot[], mode: SpreadMode, seed: string): { placed: Map<string, string>; left: string[] } {
  const room = new Map(slots.map((s) => [s.id, Math.max(0, s.capacity - s.filled)]));
  const placed = new Map<string, string>();
  const left: string[] = [];
  const open = () => slots.filter((s) => (room.get(s.id) ?? 0) > 0);
  const put = (p: Person, s: Slot) => { placed.set(p.id, s.id); room.set(s.id, room.get(s.id)! - 1); };

  let ordered: Person[];
  if (mode === "sequential") ordered = [...people];
  else if (mode === "random") ordered = shuffle(people, seed);
  else {
    const groups = new Map<string, Person[]>();
    for (const p of people) { const k = p.group ?? ""; (groups.get(k) ?? groups.set(k, []).get(k)!).push(p); }
    // Tiap kelompok diacak sendiri; urutan kelompok juga diacak agar slot pertama tidak selalu menerima kelompok yang sama.
    ordered = shuffle([...groups.keys()].sort(), `${seed}:g`).flatMap((k) => shuffle(groups.get(k)!, `${seed}:${k}`));
  }

  if (mode === "sequential") {
    for (const p of ordered) { const s = open()[0]; if (s) put(p, s); else left.push(p.id); }
  } else {
    let cursor = 0;
    for (const p of ordered) {
      const o = open();
      if (!o.length) { left.push(p.id); continue; }
      put(p, o[cursor % o.length]); cursor++;
    }
  }
  return { placed, left };
}

export type { Types };

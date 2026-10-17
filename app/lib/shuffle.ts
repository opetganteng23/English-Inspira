/** Pengacakan deterministik per percobaan: urutan yang sama setiap kali peserta memuat ulang, berbeda antar peserta. */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const r = seeded(seed), a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Urutan soal diacak, tetapi soal yang berbagi passage/audio (groupId sama dan berurutan) tetap satu blok dengan urutan aslinya. */
export function shuffleQuestionOrder<T extends { groupId?: unknown }>(items: T[], seed: string): T[] {
  const blocks: T[][] = [];
  for (const it of items) {
    const g = it.groupId ? String(it.groupId) : null;
    const last = blocks[blocks.length - 1];
    if (g && last && String(last[0].groupId ?? "") === g) last.push(it); else blocks.push([it]);
  }
  return shuffled(blocks, seed).flat();
}

type Tagged = { groupId?: unknown; tags?: { topic: string }[] };

/** Bagian soal dari tag topik: part-a/b/c (Listening) dan written-expression; selain itu satu bagian bersama (Structure, Reading). */
export function partOf(q: Pick<Tagged, "tags">): string {
  const topics = (q.tags ?? []).map((t) => t.topic);
  return topics.find((t) => /^part-[abc]$/.test(t)) ?? (topics.includes("written-expression") ? "written-expression" : "");
}

/**
 * Acak di dalam bagian: soal dibagi menjadi bagian berurutan (menurut `partOf`), tiap bagian diacak sendiri (soal yang berbagi
 * audio/bacaan tetap satu blok), lalu bagian digabung kembali sesuai urutan aslinya. Format resmi (Part A, B, C, dst.) terjaga,
 * tetapi nomor soal berbeda antar peserta.
 */
export function shuffleWithinParts<T extends Tagged>(items: T[], seed: string): T[] {
  const parts: T[][] = [];
  for (const it of items) {
    const last = parts[parts.length - 1];
    if (last && partOf(last[0]) === partOf(it)) last.push(it); else parts.push([it]);
  }
  return parts.flatMap((p, i) => shuffleQuestionOrder(p, `${seed}:p${i}`));
}

/** Urutan tampil soal sebuah section menurut pengaturan tes. Dipakai bersama oleh tampilan soal dan penegakan Secure mode. */
export function orderQuestions<T extends Tagged>(test: { shuffleQuestions?: boolean | null; shuffleWithinParts?: boolean | null }, items: T[], seed: string): T[] {
  if (test.shuffleWithinParts) return shuffleWithinParts(items, seed);
  if (test.shuffleQuestions) return shuffleQuestionOrder(items, seed);
  return items;
}

/** perm[i] = indeks ASLI dari pilihan yang tampil di posisi i. Peserta menjawab dengan indeks tampil; server menyimpan indeks asli. */
export function optionPermutation(seed: string, n: number): number[] {
  return shuffled(Array.from({ length: n }, (_, i) => i), seed);
}

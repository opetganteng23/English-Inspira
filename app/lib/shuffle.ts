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

/** perm[i] = indeks ASLI dari pilihan yang tampil di posisi i. Peserta menjawab dengan indeks tampil; server menyimpan indeks asli. */
export function optionPermutation(seed: string, n: number): number[] {
  return shuffled(Array.from({ length: n }, (_, i) => i), seed);
}

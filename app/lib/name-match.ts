// Pencocokan nama hasil tes luar ke peserta. Bagian murni (mudah diuji).

/** Huruf kecil, tanpa aksen, tanpa tanda baca, spasi tunggal. Gelar umum dibuang. */
export function normName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\b(s\s?pd|s\s?kom|s\s?h|s\s?e|m\s?pd|dr|drs|ir|mr|mrs|ms|miss)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return d[b.length];
}

/** Kemiripan 0-1. 1 = sama persis; urutan kata berbeda 0.95; sebagian kata sama atau salah ketik kecil di bawahnya. */
export function nameSimilarity(a: string, b: string) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const tx = x.split(" "), ty = y.split(" ");
  const sx = [...tx].sort().join(" "), sy = [...ty].sort().join(" ");
  if (sx === sy) return 0.95;
  // Kata yang cocok (boleh salah ketik 1 huruf untuk kata >= 5 huruf).
  const used = new Set<number>();
  let hit = 0;
  for (const w of tx) {
    const j = ty.findIndex((v, k) => !used.has(k) && (v === w || (w.length >= 5 && v.length >= 5 && lev(v, w) <= 1)));
    if (j >= 0) { used.add(j); hit++; }
  }
  const tokenScore = (2 * hit) / (tx.length + ty.length);
  const editScore = 1 - lev(sx, sy) / Math.max(sx.length, sy.length);
  return Math.round(Math.max(tokenScore * 0.9, editScore * 0.85) * 100) / 100;
}

export type Person = { id: string; name: string; email?: string };

/** Kandidat terbaik (maks 3). Email yang sama persis selalu menang. */
export function matchPerson(rawName: string, rawEmail: string | undefined, people: Person[]) {
  if (rawEmail) {
    const e = rawEmail.trim().toLowerCase();
    const p = people.find((x) => x.email?.toLowerCase() === e);
    if (p) return [{ ...p, confidence: 1 }];
  }
  return people.map((p) => ({ ...p, confidence: nameSimilarity(rawName, p.name) }))
    .filter((c) => c.confidence >= 0.5).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/** Cari nama peserta yang tertulis di dalam teks (isi PDF). Nama terpanjang yang muncul utuh dipilih. */
export function findNameInText(text: string, people: Person[]) {
  const t = ` ${normName(text)} `;
  const hits = people.filter((p) => { const n = normName(p.name); return n.split(" ").length >= 2 && t.includes(` ${n} `); });
  return hits.sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

export const AUTO_CONFIRM = 0.95; // kemiripan minimal yang dianggap pasti (sama persis / urutan kata berbeda)

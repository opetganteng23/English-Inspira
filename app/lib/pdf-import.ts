import { itpTotal, validSectionScore } from "./certificates";

// Parser dan validasi PDF hasil tes luar (MTS §14, pintu 2). Bagian murni; baca file dan DB ada di route.

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const isPdf = (b: Buffer) => b.length > 4 && b.subarray(0, 4).toString("latin1") === "%PDF";

export type ParsedScores = { listening?: number; structure?: number; reading?: number; total?: number };

const SECTION_LABELS: [keyof ParsedScores, RegExp][] = [
  ["listening", /listening(?:\s+comprehension)?/gi],
  ["structure", /(?:structure(?:\s+(?:and|&)\s+written\s+expression)?|written\s+expression)/gi],
  ["reading", /reading(?:\s+comprehension)?/gi],
];

/** Ambil angka pertama dalam rentang yang sah dalam ±60 karakter setelah label. */
function firstNumberAfter(text: string, label: RegExp, min: number, max: number) {
  label.lastIndex = 0;
  for (const m of text.matchAll(label)) {
    const slice = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 60);
    for (const n of slice.matchAll(/\d{2,3}/g)) {
      const v = Number(n[0]);
      if (v >= min && v <= max) return v;
    }
  }
  return undefined;
}

/**
 * Template yang dikenali: laporan skor bergaya TOEFL ITP (skor per section 31–68 dan total 310–677).
 * Template lain ditambah belakangan. PDF hasil scan (tanpa teks) mengembalikan kosong → peserta mengisi manual di layar verifikasi.
 */
export function parseItpScores(text: string): { template: string; scores: ParsedScores } {
  const scores: ParsedScores = {};
  for (const [k, re] of SECTION_LABELS) {
    const v = firstNumberAfter(text, re, 31, 68);
    if (v !== undefined) scores[k] = v;
  }
  const total = firstNumberAfter(text, /(?:total(?:\s+score)?|skor\s+total|overall)/gi, 310, 677);
  if (total !== undefined) scores.total = total;
  const found = Object.keys(scores).length;
  return { template: found ? (/toefl|itp|ets/i.test(text) ? "itp-report" : "generic-itp") : "unknown", scores };
}

/** Validasi nilai terverifikasi. Total dihitung dari tiga section bila lengkap; bila tidak, total manual harus 310–677. */
export function verifyScores(i: ParsedScores): { ok: true; scores: Required<Pick<ParsedScores, never>> & ParsedScores } | { ok: false; error: string } {
  const parts: (keyof ParsedScores)[] = ["listening", "structure", "reading"];
  for (const k of parts) if (i[k] !== undefined && !validSectionScore(i[k])) return { ok: false, error: `Skor ${k} harus bilangan bulat 31–68` };
  const have = parts.filter((k) => i[k] !== undefined);
  if (!have.length && i.total === undefined) return { ok: false, error: "Isi minimal satu nilai" };
  let total = i.total;
  if (have.length === 3) total = itpTotal(i.listening!, i.structure!, i.reading!);
  else if (total !== undefined && !(Number.isInteger(total) && total >= 310 && total <= 677)) return { ok: false, error: "Skor total harus 310–677" };
  return { ok: true, scores: { ...i, ...(total !== undefined ? { total } : {}) } };
}

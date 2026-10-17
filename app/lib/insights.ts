import { isLearningTopic } from "./topics";
import { typeLabel } from "./breakdown";

type Item = {
  no: number; seq?: number; section: string; correct: boolean; answered: boolean;
  firstChoice?: number | null; yourChoice?: number | null; answerKey?: number; changes?: number; timeSpentSec?: number | null;
  tags?: { skill?: string | null; topic?: string | null }[];
};
export type Mark = "c" | "w" | "b";
export type Insights = {
  outcome: { total: { correct: number; wrong: number; blank: number }; sections: { section: string; total: number; correct: number; wrong: number; blank: number }[] };
  stamina: { section: string; thirds: number[]; drop: number }[];
  time: null | { sections: { section: string; avgSec: number; items: number }[] };
  quadrants: { skill: string; topic: string; avgSec: number; accuracy: number; n: number; kind: "solid" | "slow" | "rushed" | "concept" }[];
  changes: { changed: number; toRight: number; toWrong: number; stillWrong: number } | null;
  guessing: { count: number; pct: number } | null;
  advice: string[];
};

const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const SECTION_ORDER = ["listening", "structure", "reading"];
const GUESS_SEC = 5; // dijawab kurang dari ini dan salah = kemungkinan menebak
const MIN_TYPE_N = 3; // jenis soal dengan soal lebih sedikit dari ini tidak dianalisis kecepatannya
const MIN_STAMINA_N = 9; // section lebih pendek dari ini tidak dibagi tiga

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Wawasan dari SATU percobaan, murni dihitung dari jawaban yang tersimpan (tanpa AI).
 * Aturan akurasi:
 * - Hanya agregat (per section dan per jenis soal): tidak ada hasil per nomor soal, agar bank soal tidak bocor lewat laporan.
 * - Urutan stamina memakai `seq` (urutan yang dilihat peserta, termasuk acak per percobaan), bukan nomor soal tes.
 * - Data waktu hanya dipakai bila terekam untuk minimal separuh soal yang dijawab (min. 10); bila tidak, bagian waktu disembunyikan, bukan ditebak.
 * - Perubahan jawaban memakai pilihan pertama yang disimpan server; percobaan lama tanpa itu tidak menampilkan bagian ini.
 */
export function buildInsights(review: Item[]): Insights {
  const sections = Array.from(new Set(review.map((r) => r.section))).sort((a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b));
  const mark = (r: Item): Mark => (!r.answered ? "b" : r.correct ? "c" : "w");
  const bySection = sections.map((section) => ({ section, items: review.filter((r) => r.section === section).sort((a, b) => (a.seq ?? a.no) - (b.seq ?? b.no)) }));

  const count = (items: Item[]) => ({ correct: items.filter((r) => mark(r) === "c").length, wrong: items.filter((r) => mark(r) === "w").length, blank: items.filter((r) => mark(r) === "b").length });
  const outcome = { total: count(review), sections: bySection.map((s) => ({ section: s.section, total: s.items.length, ...count(s.items) })) };

  // Stamina: akurasi (benar dari seluruh soal) per sepertiga section menurut urutan pengerjaan.
  const stamina = bySection.filter((s) => s.items.length >= MIN_STAMINA_N).map((s) => {
    const n = s.items.length, cut = [Math.round(n / 3), Math.round((2 * n) / 3)];
    const parts = [s.items.slice(0, cut[0]), s.items.slice(cut[0], cut[1]), s.items.slice(cut[1])];
    const thirds = parts.map((p) => Math.round((p.filter((r) => r.correct).length / Math.max(1, p.length)) * 100));
    return { section: s.section, thirds, drop: thirds[0] - thirds[2] };
  });

  // Waktu
  const answered = review.filter((r) => r.answered);
  const timed = answered.filter((r) => (r.timeSpentSec ?? 0) > 0);
  const hasTime = timed.length >= 10 && timed.length >= answered.length / 2;
  const time: Insights["time"] = hasTime ? {
    sections: sections.map((section) => { const t = timed.filter((r) => r.section === section); return { section, items: t.length, avgSec: t.length ? Math.round(t.reduce((a, r) => a + r.timeSpentSec!, 0) / t.length) : 0 }; }).filter((s) => s.items > 0),
  } : null;

  // Kecepatan vs akurasi per jenis soal (hanya yang punya data waktu). Batas "lambat" = median waktu antar jenis; batas "akurat" = 70%.
  const types = new Map<string, { skill: string; topic: string; times: number[]; right: number; n: number }>();
  if (hasTime) for (const r of review) {
    if (!r.answered || !((r.timeSpentSec ?? 0) > 0)) continue;
    for (const t of r.tags ?? []) {
      if (!t.skill || !t.topic || !isLearningTopic({ skill: t.skill, topic: t.topic }) || /^part-[abc]$/.test(t.topic)) continue;
      const e = types.get(`${t.skill}|${t.topic}`) ?? { skill: t.skill, topic: t.topic, times: [], right: 0, n: 0 };
      e.times.push(r.timeSpentSec!); e.n++; if (r.correct) e.right++;
      types.set(`${t.skill}|${t.topic}`, e);
    }
  }
  const eligible = [...types.values()].filter((e) => e.n >= MIN_TYPE_N);
  const mid = eligible.length >= 3 ? med(eligible.map((e) => e.times.reduce((a, b) => a + b, 0) / e.n)) : null;
  const quadrants: Insights["quadrants"] = mid == null ? [] : eligible.map((e) => {
    const avgSec = e.times.reduce((a, b) => a + b, 0) / e.n, accuracy = (e.right / e.n) * 100, slow = avgSec > mid, good = accuracy >= 70;
    return { skill: e.skill, topic: e.topic, avgSec: Math.round(avgSec), accuracy: Math.round(accuracy), n: e.n, kind: (good ? (slow ? "slow" : "solid") : slow ? "concept" : "rushed") as "solid" | "slow" | "rushed" | "concept" };
  }).sort((a, b) => a.accuracy - b.accuracy || b.n - a.n);

  // Perubahan jawaban (butuh pilihan pertama yang tersimpan)
  const withFirst = answered.filter((r) => r.firstChoice != null && r.answerKey != null && r.answerKey >= 0);
  const changed = withFirst.filter((r) => (r.changes ?? 0) > 0 && r.firstChoice !== r.yourChoice);
  const changes = withFirst.length ? {
    changed: changed.length,
    toRight: changed.filter((r) => r.firstChoice !== r.answerKey && r.correct).length,
    toWrong: changed.filter((r) => r.firstChoice === r.answerKey && !r.correct).length,
    stillWrong: changed.filter((r) => r.firstChoice !== r.answerKey && !r.correct).length,
  } : null;

  // Menebak: dijawab sangat cepat dan salah. Hanya bila data waktu tersedia.
  const guesses = hasTime ? timed.filter((r) => r.timeSpentSec! < GUESS_SEC && !r.correct).length : 0;
  const guessing = hasTime ? { count: guesses, pct: round1((guesses / Math.max(1, timed.length)) * 100) } : null;

  const advice: string[] = [];
  for (const s of stamina.filter((x) => x.drop >= 20)) advice.push(`${LABEL[s.section] ?? s.section}: accuracy fell from ${s.thirds[0]}% at the start to ${s.thirds[2]}% at the end. Practise full-length sections to build stamina.`);
  for (const q of quadrants.filter((x) => x.kind === "concept").slice(0, 2)) advice.push(`${typeLabel(q.skill, q.topic)}: slow and often wrong (${q.accuracy}%). This needs concept review before more practice.`);
  for (const q of quadrants.filter((x) => x.kind === "rushed").slice(0, 2)) advice.push(`${typeLabel(q.skill, q.topic)}: quick but only ${q.accuracy}% correct. Slow down and re-read the question.`);
  for (const q of quadrants.filter((x) => x.kind === "slow").slice(0, 1)) advice.push(`${typeLabel(q.skill, q.topic)}: accurate but slow (${q.avgSec}s on average). Practise it under time limits.`);
  if (changes && changes.toWrong > changes.toRight && changes.toWrong >= 2) advice.push(`You changed ${changes.toWrong} right answers to wrong ones and fixed only ${changes.toRight}. Trust your first answer unless you find a clear reason to change it.`);
  else if (changes && changes.toRight > changes.toWrong && changes.toRight >= 2) advice.push(`Changing answers helped you: ${changes.toRight} wrong answers became right and ${changes.toWrong} right ones became wrong.`);
  if (guessing && guessing.count >= 5 && guessing.pct >= 8) advice.push(`${guessing.count} questions were answered in under ${GUESS_SEC} seconds and missed (${guessing.pct}%). These look like guesses.`);

  return { outcome, stamina, time, quadrants, changes, guessing, advice };
}

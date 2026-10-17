import { isLearningTopic } from "./topics";

type ReviewItem = { no: number; seq?: number; section: string; answered: boolean; tags?: { skill?: string | null; topic?: string | null }[]; timeSpentSec?: number | null };
export type UnansweredReport = {
  total: number; unanswered: number; pct: number;
  sections: { section: string; total: number; unanswered: number; trailing: number }[];
  types: { skill: string; topic: string; unanswered: number; total: number }[];
  advice: string[];
};

const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

/**
 * Analisis soal yang tidak dijawab. Soal kosong dihitung salah, jadi laporan ini menjelaskan DI MANA dan KENAPA kemungkinan terjadi:
 * - `trailing`: soal kosong berturut-turut di akhir section (urutan tes) = tanda kehabisan waktu.
 * - sisanya tersebar = soal yang dilewati.
 * Saran disusun dengan aturan tetap (bukan AI), jadi selalu ada dan tidak butuh antrean analisis.
 */
export function buildUnanswered(review: ReviewItem[]): UnansweredReport {
  const total = review.length;
  const unanswered = review.filter((r) => !r.answered).length;
  const order = Array.from(new Set(review.map((r) => r.section)));
  const sections = order.map((section) => {
    const items = review.filter((r) => r.section === section).sort((a, b) => (a.seq ?? a.no) - (b.seq ?? b.no));
    let trailing = 0;
    for (let i = items.length - 1; i >= 0 && !items[i].answered; i--) trailing++;
    return { section, total: items.length, unanswered: items.filter((r) => !r.answered).length, trailing };
  });
  const byType = new Map<string, { skill: string; topic: string; unanswered: number; total: number }>();
  for (const r of review) for (const t of r.tags ?? []) {
    if (!t.skill || !t.topic || !isLearningTopic({ skill: t.skill, topic: t.topic }) || /^part-[abc]$/.test(t.topic)) continue;
    const k = `${t.skill}|${t.topic}`;
    const e = byType.get(k) ?? { skill: t.skill, topic: t.topic, unanswered: 0, total: 0 };
    e.total++; if (!r.answered) e.unanswered++;
    byType.set(k, e);
  }
  const types = [...byType.values()].filter((t) => t.unanswered > 0).sort((a, b) => b.unanswered - a.unanswered || b.total - a.total || a.topic.localeCompare(b.topic)).slice(0, 6);

  const advice: string[] = [];
  if (unanswered === 0) advice.push("You answered every question. Keep doing this: there is no penalty for a wrong answer, so a guess always beats a blank.");
  else {
    advice.push(`${unanswered} of ${total} questions were left blank and counted as wrong. There is no penalty for a wrong answer, so always pick an option, even if you are guessing.`);
    for (const s of sections.filter((x) => x.trailing >= 3)) advice.push(`${LABEL[s.section] ?? s.section}: the last ${s.trailing} questions were not answered, which usually means time ran out. Practise pacing and, when time is short, mark an answer for every remaining question.`);
    for (const s of sections.filter((x) => x.unanswered - x.trailing >= 3)) advice.push(`${LABEL[s.section] ?? s.section}: ${s.unanswered - s.trailing} questions earlier in the section were skipped. Answer a hard question with your best guess and move on instead of leaving it blank.`);
    if (types[0]) advice.push(`Most blanks were in ${types[0].topic}: ${types[0].unanswered} of ${types[0].total} questions of that type. Practise this type first.`);
  }
  return { total, unanswered, pct: total ? Math.round((unanswered / total) * 1000) / 10 : 0, sections, types, advice };
}

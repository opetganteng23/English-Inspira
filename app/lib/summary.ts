import { buildBreakdown, type TopicRow } from "./breakdown";
import { levelForScore } from "./config";

export type Reliability = "high" | "medium" | "low";
export type Zone = "priority" | "developing" | "strong" | "few";
export type SummaryInput = {
  scoreEst: number | null;
  sections: { section: string; scaled: number }[];
  review: { answered: boolean; timeSpentSec?: number | null }[];
  topics: TopicRow[];
  levels: { name: string; order: number; scoreMin: number; scoreMax: number }[];
  th: { weak: number; priority: number; minItems: number };
  durationSec: number | null;
  allottedSec: number;
  hasPrevious: boolean;
};
export type Summary = {
  reliability: { level: Reliability; headline: string; detail: string };
  answered: { done: number; total: number; pct: number };
  pace: { avgSec: number | null; realSec: number | null };
  level: { name: string; next: { name: string; scoreMin: number; avgNeeded: number } | null };
  gap: { section: string; scaled: number; gap: number }[];
  priorities: { skill: string; topic: string; score: number; correct: number; total: number; recoverable: number; tip: string }[];
  zones: { priority: number; developing: number; strong: number; few: number };
  plan: { when: string; focus: string; action: string; topic?: { skill: string; topic: string } }[];
};

const SECTION_LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const TIP: Record<string, string> = {
  grammar: "Rebuild the rule first, then practise it under time.",
  listening: "Listen for the key fact first, then read the options.",
  reading: "Find the sentence that answers the question before choosing.",
};
const PRACTICE: Record<string, string> = {
  grammar: "One rule a day: 10 items, then note why each error was wrong.",
  listening: "2 short audio clips a day: note the key fact, then check.",
  reading: "1 short passage a day: underline the evidence for each answer, then check.",
};

export function zoneOf(t: { score: number; total: number }, th: SummaryInput["th"]): Zone {
  if (t.total < th.minItems) return "few";
  if (t.score < th.priority) return "priority";
  return t.score < th.weak ? "developing" : "strong";
}

/**
 * Ringkasan diagnostic SATU percobaan (aturan tetap, bukan AI).
 * - Level dan "level berikutnya" diambil dari skor percobaan ini, bukan level peserta saat ini.
 * - Rata-rata per section yang dibutuhkan = skor level berikutnya / 10 (skala ITP: total = rata-rata section × 10).
 * - Prioritas = soal yang bisa diselamatkan: jumlah soal jenis itu × (ambang lemah − skor) / 100, hanya jenis dengan soal cukup (minItems).
 * - Keandalan: berdasarkan persen soal yang dijawab dan lama pengerjaan dibanding waktu resmi.
 */
export function buildSummary(i: SummaryInput): Summary {
  const total = i.review.length, done = i.review.filter((r) => r.answered).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const timed = i.review.filter((r) => r.answered && (r.timeSpentSec ?? 0) > 0);
  const enough = timed.length >= 10 && timed.length >= done / 2;
  const avgSec = enough ? Math.round((timed.reduce((a, r) => a + r.timeSpentSec!, 0) / timed.length) * 10) / 10 : null;
  const realSec = total && i.allottedSec ? Math.round(i.allottedSec / total) : null;
  const usedPct = i.durationSec != null && i.allottedSec ? (i.durationSec / i.allottedSec) * 100 : null;

  let level: Reliability = "high";
  if (pct < 50 || (usedPct != null && usedPct < 15)) level = "low";
  else if (pct < 85 || (usedPct != null && usedPct < 40)) level = "medium";
  const mins = i.durationSec != null ? Math.max(1, Math.round(i.durationSec / 60)) : null;
  const headline = pct >= 100 ? `You answered all ${total} questions` : `You answered ${done} of ${total} questions (${pct}%)${mins != null ? ` in about ${mins} min` : ""}`;
  const detail = level === "high"
    ? "Most questions were answered, so this score is a fair picture of your current level."
    : `Unanswered questions count as wrong, so read ${i.scoreEst ?? "the score"} as a minimum estimate.${i.hasPrevious ? " A change from your previous attempt is not reliable evidence of progress." : ""}`;

  const cur = i.scoreEst != null ? levelForScore(i.levels, i.scoreEst) : undefined;
  const nxt = cur ? i.levels.find((l) => l.order === cur.order + 1) : undefined;
  const avgNeeded = nxt ? Math.round(nxt.scoreMin / 10) : null;
  const gap = avgNeeded == null ? [] : i.sections.map((s) => ({ section: s.section, scaled: s.scaled, gap: Math.max(0, avgNeeded - s.scaled) }));

  const groups = buildBreakdown(i.topics);
  const rows = groups.flatMap((g) => g.rows);
  const zones = { priority: 0, developing: 0, strong: 0, few: 0 };
  for (const r of rows) zones[zoneOf(r, i.th)]++;
  const priorities = rows
    .filter((r) => r.total >= i.th.minItems && r.score < i.th.weak)
    .map((r) => ({ skill: r.skill, topic: r.topic, score: Math.round(r.score), correct: r.correct, total: r.total, recoverable: Math.round(r.total * ((i.th.weak - r.score) / 100) * 10) / 10, tip: TIP[r.skill] ?? "Review the rule, then practise under time." }))
    .sort((a, b) => b.recoverable - a.recoverable || a.score - b.score || a.topic.localeCompare(b.topic))
    .slice(0, 3);

  const plan: Summary["plan"] = [{
    when: "Next attempt", focus: "Test strategy",
    action: pct < 100 ? "Use the full time and answer every question: a wrong answer carries no penalty." : "Keep your pacing and use spare time to re-check the questions you were unsure about.",
  }];
  const slots = ["Weeks 1-2", "Weeks 3-4", "Weeks 5-6"];
  priorities.forEach((p, k) => plan.push({ when: slots[k], focus: p.topic, action: PRACTICE[p.skill] ?? "10 practice items a day, then review each error.", topic: { skill: p.skill, topic: p.topic } }));

  return {
    reliability: { level, headline, detail },
    answered: { done, total, pct },
    pace: { avgSec, realSec },
    level: { name: cur?.name ?? "-", next: nxt && avgNeeded != null ? { name: nxt.name, scoreMin: nxt.scoreMin, avgNeeded } : null },
    gap, priorities, zones, plan,
  };
}

export { SECTION_LABEL };

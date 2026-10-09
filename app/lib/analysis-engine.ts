import { createHash } from "node:crypto";
import { z } from "zod";

// Bagian murni mesin analisis (MTS §13.4-13.5): bentuk keluaran, validasi terhadap input, dan narasi template.
// Tanpa DB/jaringan agar mudah diuji. Pemanggilan Claude dan penyimpanan ada di lib/analysis.ts.

export const analysisResultSchema = z.object({
  summary: z.string().min(1).max(600),
  strengths: z.array(z.object({ topic: z.string(), evidence: z.string().max(300) })).max(6),
  weaknesses: z.array(z.object({ topic: z.string(), severity: z.enum(["weak", "priority"]), evidence: z.string().max(300), likelyCause: z.string().max(300) })).max(8),
  gapToNextLevel: z.object({ points: z.number(), target: z.number() }).optional(),
  recommendations: z.array(z.object({ topic: z.string(), priority: z.enum(["high", "medium"]) })).max(8),
  narrative: z.string().min(1).max(1500),
  suggestions: z.array(z.string().max(300)).min(1).max(6),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** Masukan ke Claude: hanya angka terstruktur dan alias internal. TANPA nama, email, telepon, NIK. */
export type EngineInput = {
  alias: string;
  kind: string;
  level: string | null;
  scoreEst: number | null;
  sections: { section: string; raw: number; total: number; scaled: number }[];
  topics: { topic: string; skill: string; score: number; items: number; status: string; thisAttempt: number | null }[];
  gapToNextLevel: { points: number; target: number; nextLevel: string } | null;
  behaviour: { answered: number; unanswered: number; answerChanges: number; avgSecPerAnswer: number | null; stuckTopics: string[] };
  thresholds: { weak: number; priority: number; minItems: number };
  validTopics: string[];
};

/** Alias stabil tapi tidak dapat dibalik tanpa data internal. */
export const aliasFor = (userId: string) => "p-" + createHash("sha256").update("epta-alias:" + userId).digest("hex").slice(0, 10);

/** Hash masukan (tanpa alias) untuk cache: masukan identik → narasi yang sama dipakai ulang. */
export function inputHash(i: EngineInput, promptVersion: string) {
  const { alias: _alias, ...rest } = i;
  void _alias;
  return createHash("sha256").update(promptVersion + JSON.stringify(rest)).digest("hex");
}

// ---------- Validasi keluaran terhadap masukan ----------
const NUM = /\d+(?:[.,]\d+)?/g;
// Angka yang diikuti satuan rencana/kuantitas (mis. "20 soal", "2 minggu") bukan klaim tentang data, jadi tidak dicek.
const UNIT_AFTER = /^\s*(hari|minggu|bulan|menit|jam|detik|soal|kali|sesi|butir|item|latihan|days?|weeks?|months?|minutes?|mins?|hours?|seconds?|questions?|times|sessions?|items?|exercises?|practice|x)/i;

const norm = (n: number) => Math.round(n * 10) / 10;

/** Semua angka yang boleh muncul di narasi: dari masukan, serta persen/pembulatannya. */
export function allowedNumbers(i: EngineInput) {
  const set = new Set<number>();
  const add = (n: number | null | undefined) => { if (typeof n === "number" && Number.isFinite(n)) { set.add(norm(n)); set.add(Math.round(n)); } };
  add(i.scoreEst);
  i.sections.forEach((s) => { add(s.raw); add(s.total); add(s.scaled); if (s.total) add((s.raw / s.total) * 100); });
  i.topics.forEach((t) => { add(t.score); add(t.items); add(t.thisAttempt); });
  if (i.gapToNextLevel) { add(i.gapToNextLevel.points); add(i.gapToNextLevel.target); }
  add(i.behaviour.answered); add(i.behaviour.unanswered); add(i.behaviour.answerChanges); add(i.behaviour.avgSecPerAnswer);
  add(i.thresholds.weak); add(i.thresholds.priority); add(i.thresholds.minItems);
  return set;
}

export function numbersIn(text: string) {
  const out: number[] = [];
  for (const m of text.matchAll(NUM)) {
    const after = text.slice((m.index ?? 0) + m[0].length);
    if (UNIT_AFTER.test(after)) continue;
    out.push(Number(m[0].replace(",", ".")));
  }
  return out;
}

/** Kembalikan alasan penolakan, atau null bila keluaran sah: topik harus ada di daftar valid dan angka harus berasal dari masukan. */
export function checkResult(r: AnalysisResult, i: EngineInput): string | null {
  const valid = new Set(i.validTopics);
  const topics = [...r.strengths.map((x) => x.topic), ...r.weaknesses.map((x) => x.topic), ...r.recommendations.map((x) => x.topic)];
  const bad = topics.find((t) => !valid.has(t));
  if (bad) return `Topic outside the valid list: ${bad}`;
  if (r.gapToNextLevel && i.gapToNextLevel && (r.gapToNextLevel.points !== i.gapToNextLevel.points || r.gapToNextLevel.target !== i.gapToNextLevel.target)) return "The gap to the next level does not match the data";
  if (r.gapToNextLevel && !i.gapToNextLevel) return "The gap to the next level is not in the data";
  const allowed = allowedNumbers(i);
  const texts = [r.summary, r.narrative, ...r.strengths.map((x) => x.evidence), ...r.weaknesses.map((x) => x.evidence + " " + x.likelyCause)];
  for (const t of texts) for (const n of numbersIn(t)) if (!allowed.has(norm(n)) && !allowed.has(Math.round(n))) return `The number ${n} is not in the data`;
  return null;
}

// ---------- Narasi template (cadangan, dapat diubah admin) ----------
export type NarrativeTemplate = { summary: string; strong: string; weak: string; gap: string; suggestion: string };

const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export function templateResult(i: EngineInput, tpl: NarrativeTemplate): AnalysisResult {
  const strong = i.topics.filter((t) => t.status === "strong").sort((a, b) => b.score - a.score).slice(0, 3);
  const weak = i.topics.filter((t) => t.status === "weak" || t.status === "priority").sort((a, b) => a.score - b.score).slice(0, 4);
  const v = {
    level: i.level ?? "-", score: i.scoreEst != null ? String(i.scoreEst) : "-", next: i.gapToNextLevel?.nextLevel ?? "-", gap: i.gapToNextLevel ? String(i.gapToNextLevel.points) : "0",
    strong: strong.map((t) => t.topic).join(", ") || "none yet", weak: weak.map((t) => t.topic).join(", ") || "none yet",
  };
  const parts = [fill(tpl.summary, v)];
  if (strong.length) parts.push(fill(tpl.strong, v));
  if (weak.length) parts.push(fill(tpl.weak, v));
  if (i.gapToNextLevel) parts.push(fill(tpl.gap, v));
  return {
    summary: fill(tpl.summary, v).slice(0, 600),
    strengths: strong.map((t) => ({ topic: t.topic, evidence: `Cumulative score ${norm(t.score)} from ${t.items} items.` })),
    weaknesses: weak.map((t) => ({ topic: t.topic, severity: t.status === "priority" ? "priority" as const : "weak" as const, evidence: `Cumulative score ${norm(t.score)} from ${t.items} items.`, likelyCause: "The concept needs strengthening with targeted practice." })),
    ...(i.gapToNextLevel ? { gapToNextLevel: { points: i.gapToNextLevel.points, target: i.gapToNextLevel.target } } : {}),
    recommendations: weak.map((t) => ({ topic: t.topic, priority: t.status === "priority" ? "high" as const : "medium" as const })),
    narrative: parts.join(" ").slice(0, 1500),
    suggestions: [fill(tpl.suggestion, v).slice(0, 300) || "Keep practicing and retake the test to see your progress."],
  };
}

/** Pemetaan ke bentuk lama yang dibaca halaman hasil (status/summary/weaknesses/nextSteps). */
export function toLegacy(r: AnalysisResult, engine: "claude" | "template") {
  return {
    summary: r.summary, narrative: r.narrative, strengths: r.strengths, gapToNextLevel: r.gapToNextLevel ?? null,
    weaknesses: r.weaknesses.map((w) => ({ title: w.topic, detail: `${w.evidence} ${w.likelyCause}`.trim() })),
    nextSteps: r.suggestions, mock: engine === "template", engine,
  };
}

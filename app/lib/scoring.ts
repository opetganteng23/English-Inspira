import config from "./scoring-config.json";
import type { Section } from "@/models/Question";

export type SectionResult = { section: Section; raw: number; total: number; scaled: number };

/** Raw -> skala section 31-68. Mode 'table' membaca tabel resmi dari konfigurasi. */
export function scaleSection(section: Section, raw: number, total: number): number {
  if (config.mode === "table") {
    const hit = (config.tables as Record<string, Record<string, number>>)[section]?.[String(raw)];
    if (typeof hit === "number") return hit;
  }
  if (total === 0) return config.scaledMin;
  const span = config.scaledMax - config.scaledMin;
  return Math.round(config.scaledMin + (span * raw) / total);
}

/** Skor total ITP = rata-rata 3 section x 10, rentang 310-677. */
export function estimateTotal(sections: SectionResult[]): number {
  if (!sections.length) return 310;
  const avg = sections.reduce((a, s) => a + s.scaled, 0) / sections.length;
  return Math.min(677, Math.max(310, Math.round(avg * 10)));
}

export function gradeAttempt(
  sections: { name: Section; questionIds: string[] }[],
  answerKey: Map<string, number>,
  answers: Map<string, number | undefined>
) {
  const results: SectionResult[] = sections.map((s) => {
    const raw = s.questionIds.reduce((n, id) => n + (answers.get(id) === answerKey.get(id) ? 1 : 0), 0);
    const total = s.questionIds.length;
    return { section: s.name, raw, total, scaled: scaleSection(s.name, raw, total) };
  });
  return {
    sectionScores: results,
    scoreRaw: results.reduce((a, r) => a + r.raw, 0),
    scoreEst: estimateTotal(results),
  };
}

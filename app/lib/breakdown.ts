import { isLearningTopic } from "./topics";

export type TopicRow = { skill: string; topic: string; correct: number; total: number; score: number };
export type BreakdownRow = TopicRow & { delta: number | null; few: boolean };
export type BreakdownGroup = { key: "listening" | "structure" | "reading"; label: string; rows: BreakdownRow[]; parts: TopicRow[] };

export const SECTION_LABEL = { listening: "Listening", structure: "Structure & WE", reading: "Reading" } as const;
// Soal Structure dan Written Expression ditandai skill "grammar"; ketiganya dipetakan ke section tampilannya.
const SECTION_OF: Record<string, BreakdownGroup["key"]> = { listening: "listening", grammar: "structure", structure: "structure", reading: "reading" };
const isPart = (topic: string) => /^part-[abc]$/.test(topic);
export const partLabel = (topic: string) => `Part ${topic.slice(-1).toUpperCase()}`;

/**
 * Rincian per jenis soal, dikelompokkan per section dan memuat SEMUA jenis soal (tidak dipotong).
 * - Label bagian (part-a/b/c) bukan jenis soal: dipisah ke `parts`.
 * - Label internal (oce, test-NN, written-expression) disaring, termasuk dari percobaan lama.
 * - Urutan: skor terendah dulu; bila seri, yang soalnya lebih banyak dulu (lebih bermakna). Jenis dengan kurang dari 3 soal ditandai `few`.
 */
export function buildBreakdown(topics: TopicRow[], previous?: TopicRow[] | null): BreakdownGroup[] {
  const before = new Map((previous ?? []).map((t) => [`${t.skill}|${t.topic}`, t.score]));
  const groups: BreakdownGroup[] = (["listening", "structure", "reading"] as const).map((key) => ({ key, label: SECTION_LABEL[key], rows: [], parts: [] }));
  for (const t of topics) {
    if (!t.skill || !t.topic || !isLearningTopic(t)) continue;
    const g = groups.find((x) => x.key === SECTION_OF[t.skill]);
    if (!g) continue;
    if (isPart(t.topic)) { g.parts.push(t); continue; }
    const b = before.get(`${t.skill}|${t.topic}`);
    g.rows.push({ ...t, delta: b == null ? null : Math.round(t.score - b), few: t.total < 3 });
  }
  for (const g of groups) {
    g.rows.sort((a, b) => a.score - b.score || b.total - a.total || a.topic.localeCompare(b.topic));
    g.parts.sort((a, b) => a.topic.localeCompare(b.topic));
  }
  return groups.filter((g) => g.rows.length || g.parts.length);
}

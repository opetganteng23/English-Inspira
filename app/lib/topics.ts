export type Tag = { skill: string; topic: string };

/** Tag yang bukan topik belajar: label batch impor (skill "oce", topik "test-NN") dan label format soal ("written-expression"). Tidak dihitung ke statistik, analisis, dan study plan. */
export const isLearningTopic = (t: Tag) => t.skill.toLowerCase() !== "oce" && !/^test-\d+$/i.test(t.topic) && t.topic !== "written-expression";
/** Padanan `isLearningTopic` sebagai filter Mongo untuk membaca `topic_stats` (termasuk baris lama yang sudah terlanjur terbentuk). */
export const LEARNING_TOPIC_FILTER = { $nor: [{ skill: "oce" }, { topic: "written-expression" }, { topic: /^test-\d+$/i }] };

/** Skor per topik dari satu pengerjaan: tiap soal menyumbang ke semua tag-nya. Dasar `topic_stats` (Fase 5). */
export function computeTopicScores(
  questions: { _id: unknown; tags?: Tag[] }[],
  answers: Map<string, number | undefined>,
  keys: Map<string, number>
) {
  const acc = new Map<string, { skill: string; topic: string; correct: number; total: number }>();
  for (const q of questions) {
    const id = String(q._id);
    const ok = answers.get(id) === keys.get(id);
    for (const t of (q.tags ?? []).filter(isLearningTopic)) {
      const k = `${t.skill}|${t.topic}`;
      const a = acc.get(k) ?? { skill: t.skill, topic: t.topic, correct: 0, total: 0 };
      a.total++; if (ok) a.correct++;
      acc.set(k, a);
    }
  }
  return Array.from(acc.values()).map((a) => ({ ...a, score: Math.round((a.correct / a.total) * 100) }));
}

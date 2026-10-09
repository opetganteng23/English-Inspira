export type Tag = { skill: string; topic: string };

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
    for (const t of q.tags ?? []) {
      const k = `${t.skill}|${t.topic}`;
      const a = acc.get(k) ?? { skill: t.skill, topic: t.topic, correct: 0, total: 0 };
      a.total++; if (ok) a.correct++;
      acc.set(k, a);
    }
  }
  return Array.from(acc.values()).map((a) => ({ ...a, score: Math.round((a.correct / a.total) * 100) }));
}

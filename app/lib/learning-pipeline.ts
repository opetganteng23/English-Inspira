import type { HydratedDocument } from "mongoose";
import { connectDB } from "./db";
import { updateTopicStats } from "./topic-stats";
import { detectStuck } from "./stuck";
import { refreshStudyPlan } from "./study-plan";
import { Analysis, TopicStat } from "@/models/Learning";
import { Attempt, type AttemptDoc } from "@/models/Test";

/**
 * Dijalankan setelah pengerjaan selesai (placement, sim, practice, quiz): statistik topik akumulatif,
 * deteksi stuck, dokumen `analyses` (status `calculated`, angka murni dari kode), lalu pembaruan study plan.
 * Idempoten per attempt (analysis dibuat sekali). Narasi AI menyusul di runAnalysis.
 */
export async function processAttemptLearning(attempt: HydratedDocument<AttemptDoc>) {
  await connectDB();
  if (await Analysis.exists({ attemptId: attempt._id })) return null;

  const stats = await updateTopicStats(attempt.userId, attempt.institutionId ?? undefined, attempt._id, attempt.topicScores.map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", correct: t.correct ?? 0, total: t.total ?? 0, score: t.score ?? 0 })));
  const stuck = await detectStuck(attempt._id);

  const analysis = await Analysis.create({
    userId: attempt.userId, institutionId: attempt.institutionId ?? undefined, attemptId: attempt._id,
    sourceKind: (attempt.kind ?? "practice") as "placement" | "sim" | "practice" | "quiz", status: "calculated",
    calculated: {
      scoreEst: attempt.scoreEst, sections: attempt.sectionScores,
      topics: stats.map((s) => ({ skill: s.skill, topic: s.topic, score: s.score, items: s.items, status: s.status, before: s.before })),
      stuck,
    },
  });
  await Attempt.updateOne({ _id: attempt._id }, { analysisId: analysis._id });

  // Study plan memakai seluruh statistik peserta (bukan hanya topik pengerjaan ini).
  const all = await TopicStat.find({ userId: attempt.userId }).lean();
  const plan = await refreshStudyPlan(attempt.userId, attempt.institutionId ?? undefined, all.map((t) => ({ skill: t.skill, topic: t.topic, score: t.score, status: t.status })), analysis._id);
  return { analysisId: analysis._id, plan };
}

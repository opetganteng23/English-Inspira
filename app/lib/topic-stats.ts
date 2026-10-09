import type { Types } from "mongoose";
import { connectDB } from "./db";
import { getParam } from "./config";
import { TopicStat } from "@/models/Learning";

export type TopicStatus = "strong" | "ok" | "weak" | "priority" | "insufficient";
export const STRONG_FROM = 80; // di atas ini dianggap kuat (MTS hanya mengatur ambang weak/priority)

/** Skor baru = alpha × skor pengerjaan + (1 − alpha) × skor lama. Topik baru: skor pengerjaan apa adanya. */
export function nextTopicScore(old: number | null, attemptScore: number, alpha: number) {
  return old == null ? attemptScore : Math.round((alpha * attemptScore + (1 - alpha) * old) * 10) / 10;
}

/** Status topik. Butir < minItems → "insufficient" (belum cukup data), tidak dinilai lemah. */
export function topicStatus(score: number, items: number, th: { weak: number; priority: number; minItems: number }): TopicStatus {
  if (items < th.minItems) return "insufficient";
  if (score < th.priority) return "priority";
  if (score < th.weak) return "weak";
  return score >= STRONG_FROM ? "strong" : "ok";
}

type Scored = { skill: string; topic: string; correct: number; total: number; score: number };

/** Gabungkan skor satu pengerjaan ke statistik akumulatif peserta; kembalikan status sebelum/sesudah per topik. */
export async function updateTopicStats(userId: Types.ObjectId | string, institutionId: Types.ObjectId | string | undefined, attemptId: Types.ObjectId | string, scores: Scored[]) {
  await connectDB();
  const [alpha, th] = await Promise.all([getParam("alpha"), getParam("weakness")]);
  const out: { skill: string; topic: string; score: number; items: number; status: TopicStatus; before: TopicStatus | null }[] = [];
  for (const s of scores) {
    if (!s.total) continue;
    const cur = await TopicStat.findOne({ userId, skill: s.skill, topic: s.topic });
    const items = (cur?.items ?? 0) + s.total;
    const score = nextTopicScore(cur?.score ?? null, s.score, alpha);
    const status = topicStatus(score, items, th);
    await TopicStat.updateOne(
      { userId, skill: s.skill, topic: s.topic },
      { $set: { score, items, status, lastAttemptId: attemptId, ...(institutionId ? { institutionId } : {}) } },
      { upsert: true }
    );
    out.push({ skill: s.skill, topic: s.topic, score, items, status, before: (cur?.status as TopicStatus | undefined) ?? null });
  }
  return out;
}

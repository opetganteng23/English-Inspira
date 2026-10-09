import type { Types } from "mongoose";
import { connectDB } from "./db";
import { getParam } from "./config";
import { Attempt } from "@/models/Test";
import { Question } from "@/models/Question";

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Topik tempat peserta "stuck" (MTS §13.2): waktu > N× median soal (hanya bila median tersedia, yaitu sampel cukup)
 * ATAU N jawaban salah beruntun pada topik yang sama.
 */
export function stuckFrom(
  items: { qid: string; topics: string[]; wrong: boolean; timeSec: number | null }[],
  medians: Map<string, number>,
  cfg: { medianMultiplier: number; consecutiveWrong: number }
) {
  const hit = new Set<string>();
  for (const it of items) {
    const m = medians.get(it.qid);
    if (m && it.timeSec != null && it.timeSec > cfg.medianMultiplier * m) it.topics.forEach((t) => hit.add(t));
  }
  const run = new Map<string, number>();
  for (const it of items) {
    for (const t of it.topics) {
      const n = it.wrong ? (run.get(t) ?? 0) + 1 : 0;
      run.set(t, n);
      if (n >= cfg.consecutiveWrong) hit.add(t);
    }
  }
  return Array.from(hit);
}

/** Median waktu per soal dari pengerjaan peserta lain (sampel ≥ minSamples), lalu deteksi stuck untuk satu attempt. */
export async function detectStuck(attemptId: Types.ObjectId | string): Promise<string[]> {
  await connectDB();
  const cfg = await getParam("stuck");
  const a = await Attempt.findById(attemptId).lean();
  if (!a) return [];
  const qids = a.answers.map((x) => x.qid).filter((q): q is NonNullable<typeof q> => !!q);
  const qs = await Question.find({ _id: { $in: qids } }).select("answerKey tags").lean();
  const byId = new Map(qs.map((q) => [String(q._id), q]));
  const others = await Attempt.aggregate([
    { $match: { status: "submitted", _id: { $ne: a._id }, "answers.qid": { $in: qids } } },
    { $unwind: "$answers" },
    { $match: { "answers.qid": { $in: qids }, "answers.timeSpentSec": { $gt: 0 } } },
    { $group: { _id: "$answers.qid", times: { $push: "$answers.timeSpentSec" } } },
  ]);
  const medians = new Map<string, number>();
  for (const o of others) if (o.times.length >= cfg.minSamples) medians.set(String(o._id), median(o.times));
  const items = a.answers.map((x) => {
    const q = byId.get(String(x.qid));
    return { qid: String(x.qid), topics: (q?.tags ?? []).map((t) => `${t.skill}|${t.topic}`), wrong: !q || x.choice !== q.answerKey, timeSec: x.timeSpentSec ?? null };
  });
  return stuckFrom(items, medians, cfg);
}

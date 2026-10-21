import type { Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { audit } from "./audit";
import { gradeAttempt } from "./scoring";
import { profileForTest, toConversion } from "./scoring-profiles";
import { computeTopicScores } from "./topics";
import { Attempt, AttemptSnapshot, Test } from "@/models/Test";
import { Question, type Section } from "@/models/Question";

/**
 * Kompensasi gangguan sistem: soal yang jawabannya hilang karena bug (tidak pernah tersimpan) dinilai BENAR, lalu skor dihitung ulang
 * dengan penilaian yang sama. Hanya untuk soal yang kosong dan hanya sebelum hasil dirilis (level, kuota, email belum dijalankan).
 */
export async function creditLostAnswers(attemptId: string, qids: string[], adminId: Types.ObjectId | undefined, reason: string) {
  await connectDB();
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw new HttpError(404, "Attempt not found");
  if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
  if (!attempt.releaseAt || attempt.releasedAt) throw new HttpError(409, "This result is already released; regrading it here is not allowed.");
  const test = await Test.findById(attempt.testId).lean();
  if (!test) throw new HttpError(404, "Test not found");
  const snap = await AttemptSnapshot.findOne({ attemptId: attempt._id }).lean();
  const qs = snap?.items?.length ? snap.items.map((x) => ({ ...x, _id: x.qid })) : await Question.find({ _id: { $in: test.sections.flatMap((s) => s.questionIds) } }).select("section type groupId answerKey tags").lean();
  const keys = new Map<string, number>(qs.map((q) => [String(q._id), q.answerKey as number]));
  const before = { score: attempt.scoreEst, sections: attempt.sectionScores.map((s) => `${s.section} ${s.raw}/${s.total}=${s.scaled}`) };
  const credited: string[] = [];
  for (const qid of qids) {
    if (!keys.has(qid)) continue;
    const cur = attempt.answers.find((a) => String(a.qid) === qid);
    if (cur?.choice != null) continue; // hanya soal yang kosong
    const k = keys.get(qid)!;
    if (cur) Object.assign(cur, { choice: k, firstChoice: k });
    else attempt.answers.push({ qid, choice: k, firstChoice: k, changes: 0 } as never);
    credited.push(qid);
  }
  if (!credited.length) return { credited: 0, before, after: before };
  const answers = new Map<string, number | undefined>(attempt.answers.map((a) => [String(a.qid), a.choice ?? undefined]));
  const prof = await profileForTest(test as { scoringProfileId?: Types.ObjectId | null });
  const graded = gradeAttempt(toConversion(prof), test.sections.map((s) => ({ name: s.name as Section, questionIds: s.questionIds.map(String) })), keys, answers);
  const topicScores = computeTopicScores(qs as never, answers, keys);
  attempt.set({ ...graded, topicScores });
  await attempt.save();
  const after = { score: attempt.scoreEst, sections: attempt.sectionScores.map((s) => `${s.section} ${s.raw}/${s.total}=${s.scaled}`) };
  await audit(adminId, "attempt.credit_lost_answers", attemptId, { userId: String(attempt.userId), qids: credited, reason, before, after });
  return { credited: credited.length, before, after };
}

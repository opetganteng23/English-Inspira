import { isValidObjectId, type HydratedDocument } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { gradeAttempt } from "./scoring";
import { getParam } from "./config";
import { computeTopicScores } from "./topics";
import { applyPlacement } from "./placement";
import { User } from "@/models/User";
import { runAnalysis } from "./analysis";
import { processAttemptLearning } from "./learning-pipeline";
import { ensureSimReport } from "./certificates";
import { Attempt, Test, type AttemptDoc } from "@/models/Test";
import { Question, type Section } from "@/models/Question";
import type { UserDoc } from "@/models/User";

export type AttemptHydrated = HydratedDocument<AttemptDoc>;

/** Ambil attempt milik user (admin boleh semua), lalu terapkan timer server. */
export async function loadAttempt(id: string, user: Pick<UserDoc, "_id" | "role">) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Attempt tidak ditemukan");
  await connectDB();
  const attempt = await Attempt.findById(id);
  if (!attempt || (String(attempt.userId) !== String(user._id) && user.role !== "admin"))
    throw new HttpError(404, "Attempt tidak ditemukan");
  const test = await Test.findById(attempt.testId).lean();
  if (!test) throw new HttpError(500, "Tes tidak ditemukan");
  await syncTimer(attempt, test);
  return { attempt, test };
}

export function sectionDeadline(attempt: AttemptHydrated, test: { sections: { durationSec: number }[] }) {
  return attempt.sectionStartedAt.getTime() + test.sections[attempt.sectionIdx].durationSec * 1000;
}

/** Section yang waktunya habis maju otomatis; bila semua habis, attempt di-submit. */
export async function syncTimer(attempt: AttemptHydrated, test: { sections: { name: string; durationSec: number; questionIds: unknown[] }[] }) {
  if (attempt.status !== "in_progress") return;
  let changed = false;
  while (attempt.status === "in_progress" && Date.now() >= sectionDeadline(attempt, test)) {
    const expiredAt = sectionDeadline(attempt, test);
    if (attempt.sectionIdx + 1 >= test.sections.length) {
      await finalize(attempt, test, new Date(expiredAt));
      return;
    }
    attempt.sectionIdx += 1;
    attempt.sectionStartedAt = new Date(expiredAt);
    changed = true;
  }
  if (changed) await attempt.save();
}

export async function advance(attempt: AttemptHydrated, test: Parameters<typeof syncTimer>[1]) {
  if (attempt.status !== "in_progress") throw new HttpError(409, "Tes sudah selesai");
  if (attempt.sectionIdx + 1 >= test.sections.length) return finalize(attempt, test);
  attempt.sectionIdx += 1;
  attempt.sectionStartedAt = new Date();
  await attempt.save();
}

export async function finalize(attempt: AttemptHydrated, test: Parameters<typeof syncTimer>[1], at = new Date()) {
  if (attempt.status === "submitted") return;
  const ids = test.sections.flatMap((s) => s.questionIds.map(String));
  const qs = await Question.find({ _id: { $in: ids } }).select("answerKey tags").lean();
  const keys = new Map<string, number>(qs.map((q) => [String(q._id), q.answerKey]));
  const answers = new Map<string, number | undefined>(attempt.answers.map((a) => [String(a.qid), a.choice ?? undefined]));
  const conv = await getParam("score_conversion"); // tabel konversi dari config_params, bukan hard-code
  const graded = gradeAttempt(
    conv,
    test.sections.map((s) => ({ name: s.name as Section, questionIds: s.questionIds.map(String) })),
    keys,
    answers
  );
  const topicScores = computeTopicScores(qs, answers, keys);
  attempt.set({ ...graded, topicScores, status: "submitted", finishedAt: at });
  await attempt.save();

  // Efek samping setelah submit: tidak boleh menggagalkan submit, dan tidak memblokir respons.
  void (async () => {
    try {
      if (attempt.kind === "placement") await applyPlacement(attempt);
      else if (attempt.kind === "sim" && attempt.scoreEst != null) await User.updateOne({ _id: attempt.userId }, { currentScoreEst: attempt.scoreEst });
      if (attempt.kind === "sim") await ensureSimReport(attempt._id);
    } catch (e) { console.error("[finalize] efek samping gagal", e); }
    try { await processAttemptLearning(attempt); } catch (e) { console.error("[finalize] pipeline belajar gagal", e); }
    void runAnalysis(attempt._id);
  })();
}

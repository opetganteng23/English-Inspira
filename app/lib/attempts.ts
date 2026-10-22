import { creditGap } from "./conn";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { gradeAttempt } from "./scoring";
import { profileForTest, toConversion } from "./scoring-profiles";

import { computeTopicScores } from "./topics";
import { applyPlacement } from "./placement";
import { User } from "@/models/User";
import { runAnalysis } from "./analysis";
import { processAttemptLearning } from "./learning-pipeline";
import { recordQuizResult, recordSectionTestResult } from "./units";
import { evaluateLevelUp } from "./level-up";
import { ensureSimReport } from "./certificates";
import { Attempt, Test, type AttemptDoc, AttemptSnapshot } from "@/models/Test";
import { Question, type Section } from "@/models/Question";
import type { UserDoc } from "@/models/User";

export type AttemptHydrated = HydratedDocument<AttemptDoc>;

/** Ambil attempt milik user (admin boleh semua), lalu terapkan timer server. */
export async function loadAttempt(id: string, user: Pick<UserDoc, "_id" | "role">) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Attempt not found");
  await connectDB();
  const attempt = await Attempt.findById(id);
  if (!attempt || (String(attempt.userId) !== String(user._id) && user.role !== "admin"))
    throw new HttpError(404, "Attempt not found");
  const test = await Test.findById(attempt.testId).lean();
  if (!test) throw new HttpError(500, "Test not found");
  // Peserta sendiri kembali setelah koneksi putus: kembalikan waktu yang hilang sebelum timer diperiksa.
  if (String(attempt.userId) === String(user._id)) await creditGap(attempt as never);
  try {
    await syncTimer(attempt, test);
  } catch (e) {
    // Dua permintaan memajukan/menyelesaikan percobaan yang sama bersamaan: yang kalah memuat ulang keadaan terbaru, bukan gagal.
    if (!isVersionError(e)) throw e;
    const fresh = await Attempt.findById(id);
    if (!fresh) throw e;
    await syncTimer(fresh, test);
    return { attempt: fresh, test };
  }
  return { attempt, test };
}

export const isVersionError = (e: unknown) => (e as { name?: string } | null)?.name === "VersionError";

export function sectionDeadline(attempt: AttemptHydrated, test: { sections: { durationSec: number }[] }) {
  // + waktu tambahan karena koneksi terputus (lib/conn creditGap)
  return attempt.sectionStartedAt.getTime() + (test.sections[attempt.sectionIdx].durationSec + (attempt.timeCredits?.[attempt.sectionIdx] ?? 0)) * 1000;
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
    attempt.secureReached = 0;
    attempt.sectionStartedAt = new Date(expiredAt);
    changed = true;
  }
  if (changed) await attempt.save();
}

/** `advance` yang tahan balapan: bila permintaan lain sudah memajukan atau men-submit percobaan ini, hasilnya dianggap berhasil. Mengembalikan status terbaru. */
export async function advanceSafely(attempt: AttemptHydrated, test: Parameters<typeof syncTimer>[1]): Promise<"in_progress" | "submitted"> {
  const idx = attempt.sectionIdx;
  try {
    await advance(attempt, test);
    return attempt.status as "in_progress" | "submitted";
  } catch (e) {
    if (!isVersionError(e)) throw e;
    const fresh = await Attempt.findById(attempt._id).select("status sectionIdx");
    if (fresh && (fresh.status === "submitted" || fresh.sectionIdx > idx)) return fresh.status as "in_progress" | "submitted";
    throw e;
  }
}

export async function advance(attempt: AttemptHydrated, test: Parameters<typeof syncTimer>[1]) {
  if (attempt.status !== "in_progress") throw new HttpError(409, "The test is already finished");
  if (attempt.sectionIdx + 1 >= test.sections.length) return finalize(attempt, test);
  attempt.sectionIdx += 1;
  attempt.secureReached = 0;
  attempt.sectionStartedAt = new Date();
  await attempt.save();
}

export async function finalize(attempt: AttemptHydrated, test: Parameters<typeof syncTimer>[1], at = new Date()) {
  if (attempt.status === "submitted") return;
  const ids = test.sections.flatMap((s) => s.questionIds.map(String));
  const qs = await Question.find({ _id: { $in: ids } }).select("section type groupId stem options answerKey explanation tags").lean();
  const keys = new Map<string, number>(qs.map((q) => [String(q._id), q.answerKey]));
  const answers = new Map<string, number | undefined>(attempt.answers.map((a) => [String(a.qid), a.choice ?? undefined]));
  const prof = await profileForTest(test as { scoringProfileId?: import("mongoose").Types.ObjectId | null }); // profil penilaian tes (atau bawaan)
  const conv = toConversion(prof);
  const graded = gradeAttempt(
    conv,
    test.sections.map((s) => ({ name: s.name as Section, questionIds: s.questionIds.map(String) })),
    keys,
    answers
  );
  const topicScores = computeTopicScores(qs, answers, keys);
  attempt.set({ ...graded, topicScores, status: "submitted", finishedAt: at, scoringProfileId: prof._id, scoringVersion: prof.version, scoreBasis: prof.verified ? "verified" : "provisional" });
  await attempt.save();
  // Snapshot soal sesuai urutan tes (tidak boleh menggagalkan submit).
  try {
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const items = ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q).map((q) => ({
      qid: q._id, section: q.section, type: q.type, groupId: q.groupId, stem: q.stem, options: q.options, answerKey: q.answerKey, explanation: q.explanation,
      tags: (q.tags ?? []).map((t) => ({ skill: t.skill, topic: t.topic })),
    }));
    await AttemptSnapshot.updateOne({ attemptId: attempt._id }, { $set: { items } }, { upsert: true });
  } catch (e) { console.error("[finalize] snapshot failed", e); }

  // Efek samping setelah submit: tidak boleh menggagalkan submit, dan tidak memblokir respons.
  // Bila hasil ditahan (releaseAt di masa depan), efek (level, kuota, email, analisis) ditunda sampai dilepas oleh releaseDueResults.
  if (attempt.releaseAt) {
    if (attempt.releaseAt > new Date()) {
      // Hasil placement ditahan institusi: Class tetap dibentuk sekarang dari skornya; level, skor, dan nama Class baru terlihat saat dirilis.
      if (attempt.kind === "placement" && attempt.get("heldByOrg") && attempt.scoreEst != null) {
        try {
          const { getLevels, levelForScore } = await import("./config");
          const { assignClass } = await import("./clustering");
          const lv = levelForScore(await getLevels(), attempt.scoreEst);
          if (lv) await assignClass(String(attempt.userId), undefined, "auto", null, lv._id);
        } catch (e) { console.error("[finalize] held class assignment failed", e); }
      }
      return;
    }
    await Attempt.updateOne({ _id: attempt._id }, { $set: { releasedAt: new Date() } }); // sudah lewat waktu rilis: jalankan sekarang, jangan diulang oleh cron
  }
  void runAttemptEffects(attempt);
}

/** Efek hasil tes: level dan kuota (placement), laporan, pipeline belajar, naik level, dan analisis AI. */
export async function runAttemptEffects(attempt: AttemptHydrated) {
  try {
    const isSimLike = attempt.kind === "sim" || attempt.kind === "final"; // Final Test dinilai dan dilaporkan sama seperti simulasi (MTS §12)
    if (attempt.kind === "placement") await applyPlacement(attempt);
    else if (isSimLike && attempt.scoreEst != null) await User.updateOne({ _id: attempt.userId }, { currentScoreEst: attempt.scoreEst });
    if (isSimLike) await ensureSimReport(attempt._id);
    if (attempt.kind === "quiz") await recordQuizResult(attempt);
    if (attempt.kind === "section") await recordSectionTestResult(attempt);
  } catch (e) { console.error("[finalize] side effects failed", e); }
  try { await processAttemptLearning(attempt); } catch (e) { console.error("[finalize] learning pipeline failed", e); }
  try { if (attempt.kind === "sim" || attempt.kind === "final") await evaluateLevelUp(attempt); } catch (e) { console.error("[finalize] level-up check failed", e); } // setelah pipeline: memakai rencana yang sudah diperbarui
  void runAnalysis(attempt._id);
}

/** Tiap menit: lepas hasil yang sudah jatuh tempo (jalankan efeknya). Klaim atomik agar dua proses tidak menjalankan efek yang sama. */
export async function releaseDueResults(limit = 100) {
  await connectDB();
  let n = 0;
  for (let i = 0; i < limit; i++) {
    const a = await Attempt.findOneAndUpdate({ status: "submitted", releaseAt: { $lte: new Date() }, releasedAt: { $exists: false } }, { $set: { releasedAt: new Date() } }, { returnDocument: "after" });
    if (!a) break;
    await runAttemptEffects(a);
    n++;
  }
  return n;
}

/** Peserta membuka hasilnya setelah waktu rilis tetapi cron belum memprosesnya: jalankan efek miliknya sekarang (klaim atomik, tidak ganda dengan cron). */
export async function ensureReleased(attempt: AttemptHydrated) {
  if (!attempt.releaseAt || attempt.releasedAt || attempt.releaseAt > new Date()) return;
  const claimed = await Attempt.findOneAndUpdate({ _id: attempt._id, releasedAt: { $exists: false } }, { $set: { releasedAt: new Date() } }, { returnDocument: "after" });
  if (claimed) await runAttemptEffects(claimed);
}

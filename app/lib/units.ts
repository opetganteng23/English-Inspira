import type { HydratedDocument, Types } from "mongoose";
import { connectDB } from "./db";
import { getParam } from "./config";
import { Course, Unit, UnitProgress } from "@/models/Course";
import type { AttemptDoc } from "@/models/Test";

/** Unit selesai bila semua materi wajib selesai dan (bila ada kuis) kuisnya lulus. */
export function unitComplete(requiredMaterialIds: string[], done: Set<string>, hasQuiz: boolean, quizPassed: boolean) {
  return requiredMaterialIds.every((id) => done.has(id)) && (!hasQuiz || quizPassed);
}

/** Persen benar dari skor section sebuah attempt (dasar `unit_pass_score`, bukan skala 310–677). */
export function percentCorrect(sections: { raw?: number | null; total?: number | null }[]) {
  const raw = sections.reduce((a, s) => a + (s.raw ?? 0), 0), total = sections.reduce((a, s) => a + (s.total ?? 0), 0);
  return total ? Math.round((raw / total) * 100) : 0;
}

async function recompute(userId: Types.ObjectId | string, unitId: Types.ObjectId | string) {
  const unit = await Unit.findById(unitId).lean();
  if (!unit) return null;
  const p = await UnitProgress.findOne({ userId, unitId });
  if (!p) return null;
  const complete = unitComplete(unit.materialIds.map(String), new Set(p.materialsDone.map(String)), !!unit.quizTestId, p.quizPassed);
  if (complete && p.status !== "completed") { p.status = "completed"; p.completedAt = new Date(); }
  else if (!complete && p.status === "completed") { p.status = "in_progress"; p.completedAt = undefined; }
  await p.save();
  return p;
}

/** Materi selesai → tandai di semua unit aktif yang mensyaratkannya (hanya course di level peserta). */
export async function markMaterialDone(user: { _id: Types.ObjectId; institutionId?: Types.ObjectId | null; currentLevelId?: Types.ObjectId | null }, materialId: Types.ObjectId | string) {
  await connectDB();
  if (!user.currentLevelId) return;
  const courses = await Course.find({ levelId: user.currentLevelId, active: true }).select("_id").lean();
  const units = await Unit.find({ courseId: { $in: courses.map((c) => c._id) }, materialIds: materialId, active: true }).lean();
  for (const u of units) {
    await UnitProgress.updateOne(
      { userId: user._id, unitId: u._id },
      { $addToSet: { materialsDone: materialId }, $setOnInsert: { courseId: u.courseId, ...(user.institutionId ? { institutionId: user.institutionId } : {}) } },
      { upsert: true }
    );
    await recompute(user._id, u._id);
  }
}

/** Kuis unit selesai → simpan skor terbaik, nilai lulus terhadap `unit_pass_score`, hitung ulang status unit. */
export async function recordQuizResult(attempt: HydratedDocument<AttemptDoc>) {
  await connectDB();
  if (!attempt.unitId) return null;
  const unit = await Unit.findById(attempt.unitId).lean();
  if (!unit) return null;
  const pass = await getParam("unit_pass_score");
  const pct = percentCorrect(attempt.sectionScores);
  const cur = await UnitProgress.findOne({ userId: attempt.userId, unitId: unit._id });
  const best = Math.max(cur?.quizBest ?? 0, pct);
  await UnitProgress.updateOne(
    { userId: attempt.userId, unitId: unit._id },
    { $set: { quizBest: best, quizPassed: (cur?.quizPassed ?? false) || pct >= pass }, $setOnInsert: { courseId: unit.courseId, ...(attempt.institutionId ? { institutionId: attempt.institutionId } : {}) } },
    { upsert: true }
  );
  return { percent: pct, passed: pct >= pass, unit: await recompute(attempt.userId, unit._id) };
}

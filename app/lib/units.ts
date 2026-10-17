import type { HydratedDocument, Types } from "mongoose";
import { connectDB } from "./db";
import { getParam } from "./config";
import { Course, CourseProgress, RemedialMap, Unit, UnitProgress } from "@/models/Course";
import { LIVE, PREVIEW_VISIBLE, unitAccess } from "./course-access";
import { cycleState } from "./cycles";
import type { AttemptDoc } from "@/models/Test";

/** Unit selesai bila semua materi wajib selesai dan (bila ada kuis) kuisnya lulus. */
export function unitComplete(requiredMaterialIds: string[], done: Set<string>, hasQuiz: boolean, quizPassed: boolean) {
  return requiredMaterialIds.every((id) => done.has(id)) && (!hasQuiz || quizPassed);
}

/** Persen benar dari skor section sebuah attempt (dasar `unit_pass_score`, bukan skala 310-677). */
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

/** Unit remedial untuk topik: unit pertama di peta remedial yang courses-nya aktif dan sesuai level peserta. */
export async function findRemedialUnit(levelId: Types.ObjectId | string | null | undefined, skill: string, topic: string) {
  if (!levelId) return null;
  await connectDB();
  const maps = await RemedialMap.find({ skill, topic }).lean();
  if (!maps.length) return null;
  const units = await Unit.find({ _id: { $in: maps.map((m) => m.unitId) }, active: true }).lean();
  const courses = await Course.find({ _id: { $in: units.map((u) => u.courseId) }, levelId, ...LIVE }).select("_id").lean();
  const ok = new Set(courses.map((c) => String(c._id)));
  return units.find((u) => ok.has(String(u.courseId)))?._id ?? null;
}

/** Materi selesai → tandai di semua unit aktif yang mensyaratkannya (hanya course di level peserta). */
export async function markMaterialDone(user: { _id: Types.ObjectId; institutionId?: Types.ObjectId | null; currentLevelId?: Types.ObjectId | null; qaTester?: boolean | null }, materialId: Types.ObjectId | string) {
  await connectDB();
  const qa = !!user.qaTester; // QA tester menguji semua level dan course mode preview, tanpa prasyarat dan drip
  if (!user.currentLevelId && !qa) return;
  if (!qa && (await cycleState(user.institutionId)).blockedReason) return; // periode ditutup: materi hanya dibaca, progres tidak berubah
  const courses = await Course.find(qa ? { ...PREVIEW_VISIBLE } : { levelId: user.currentLevelId, ...LIVE }).select("_id prerequisiteCourseIds").lean();
  const units = await Unit.find({ courseId: { $in: courses.map((c) => c._id) }, materialIds: materialId, active: true }).lean();
  for (const u of units) {
    // Unit yang masih terkunci (prasyarat/drip) tidak mencatat progres.
    const course = courses.find((c) => String(c._id) === String(u.courseId))!;
    if (!qa && !(await unitAccess(user._id, u, course)).ok) continue;
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

/** Semua unit aktif course sudah selesai oleh peserta ini? (syarat membuka ujian per bagian) */
export async function courseUnitsComplete(userId: Types.ObjectId | string, courseId: Types.ObjectId | string) {
  const units = await Unit.find({ courseId, active: true }).select("_id").lean();
  if (!units.length) return false;
  const done = await UnitProgress.countDocuments({ userId, unitId: { $in: units.map((u) => u._id) }, status: "completed" });
  return done >= units.length;
}

/** Ujian per bagian selesai → simpan skor terbaik, jumlah percobaan, dan status lulus (`unit_pass_score`). */
export async function recordSectionTestResult(attempt: HydratedDocument<AttemptDoc>) {
  await connectDB();
  if (!attempt.courseId) return null;
  const pass = await getParam("unit_pass_score");
  const pct = percentCorrect(attempt.sectionScores);
  const cur = await CourseProgress.findOne({ userId: attempt.userId, courseId: attempt.courseId });
  await CourseProgress.updateOne(
    { userId: attempt.userId, courseId: attempt.courseId },
    { $set: { sectionTestBest: Math.max(cur?.sectionTestBest ?? 0, pct), sectionTestPassed: (cur?.sectionTestPassed ?? false) || pct >= pass, ...(attempt.institutionId ? { institutionId: attempt.institutionId } : {}) }, $inc: { sectionTestAttempts: 1 } },
    { upsert: true }
  );
  return { percent: pct, passed: pct >= pass };
}

/** Rekomendasi course untuk topik lemah: unit remedial + course-nya (level peserta) dan status belajar peserta. */
export async function recommendCourses(userId: Types.ObjectId | string, levelId: Types.ObjectId | string | null | undefined, topics: { skill: string; topic: string; score: number; correct: number; total: number }[]) {
  const out: { skill: string; topic: string; score: number; correct: number; total: number; unit: { id: string; title: string; status: "new" | "in_progress" | "completed" }; course: { id: string; title: string } }[] = [];
  for (const t of topics) {
    const unitId = await findRemedialUnit(levelId, t.skill, t.topic);
    if (!unitId) continue;
    const unit = await Unit.findById(unitId).select("title courseId").lean();
    const course = unit ? await Course.findById(unit.courseId).select("title").lean() : null;
    if (!unit || !course) continue;
    const p = await UnitProgress.findOne({ userId, unitId }).select("status").lean();
    out.push({ ...t, unit: { id: String(unitId), title: unit.title, status: p?.status ?? "new" }, course: { id: String(course._id), title: course.title } });
  }
  return out;
}

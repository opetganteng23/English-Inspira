import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { Course } from "@/models/Course";
import { Material } from "@/models/Material";
import { Test } from "@/models/Test";

/** Validasi referensi unit: course ada, materi ada, kuis berjenis quiz dan tidak dipakai unit lain. */
export async function validateUnit(b: { courseId: string; materialIds: string[]; quizTestId?: string | null }, exceptUnitId?: string) {
  if (!(await Course.exists({ _id: b.courseId }))) throw new HttpError(400, "Course not found");
  if (new Set(b.materialIds).size !== b.materialIds.length) throw new HttpError(400, "Duplicate material in one unit");
  if (b.materialIds.length && (await Material.countDocuments({ _id: { $in: b.materialIds } })) !== b.materialIds.length) throw new HttpError(400, "Some materials were not found");
  if (b.quizTestId) {
    const t = await Test.findById(b.quizTestId).select("kind unitId").lean();
    if (!t || t.kind !== "quiz") throw new HttpError(400, "The quiz must be a test of type Unit quiz");
    if (t.unitId && String(t.unitId) !== exceptUnitId) throw new HttpError(409, "This quiz is already used by another unit");
  }
}

/** Jaga Test.unitId sinkron dengan Unit.quizTestId (kuis hanya bisa dimulai dari unit pemiliknya). */
export async function syncQuizOwner(unitId: Types.ObjectId | string, quizTestId: string | null) {
  await Test.updateMany({ unitId, ...(quizTestId ? { _id: { $ne: quizTestId } } : {}) }, { $unset: { unitId: 1 } });
  if (quizTestId) await Test.updateOne({ _id: quizTestId }, { unitId });
}

import { HttpError } from "./rbac";
import { hasCycle } from "./course-access";
import { Course } from "@/models/Course";
import { Asset } from "@/models/Asset";
import { Test } from "@/models/Test";

/** Validasi rujukan course: cover berupa gambar publik, prasyarat ada, tidak ke diri sendiri, tidak melingkar. */
export async function checkCourseRefs(b: { coverAssetId?: string | null; prerequisiteCourseIds: string[]; sectionTestId?: string | null }, selfId?: string) {
  if (b.sectionTestId) {
    const t = await Test.findById(b.sectionTestId).select("kind").lean();
    if (!t || t.kind !== "section") throw new HttpError(400, "The section test must be a test of type Section test");
  }
  if (b.coverAssetId) {
    const a = await Asset.findById(b.coverAssetId).select("mime sensitive").lean();
    if (!a || a.sensitive || !String(a.mime).startsWith("image/")) throw new HttpError(400, "The cover must be an uploaded image");
  }
  const pre = [...new Set(b.prerequisiteCourseIds)];
  if (!pre.length) return;
  if (selfId && pre.includes(selfId)) throw new HttpError(400, "A course cannot be its own prerequisite");
  const found = await Course.find({ _id: { $in: pre } }).select("prerequisiteCourseIds").lean();
  if (found.length !== pre.length) throw new HttpError(400, "Some prerequisite courses were not found");
  if (selfId) {
    const all = await Course.find().select("prerequisiteCourseIds").lean();
    const edges = new Map(all.map((c) => [String(c._id), (c.prerequisiteCourseIds ?? []).map(String)]));
    if (hasCycle(selfId, pre, edges)) throw new HttpError(400, "Prerequisites cannot form a loop");
  }
}

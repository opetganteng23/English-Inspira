import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { Course, CourseProgress, Unit, UnitProgress } from "@/models/Course";

/** Course yang terlihat peserta: aktif, tidak diarsipkan, dan bukan mode preview. */
export const LIVE = { active: true, archived: { $ne: true }, previewMode: { $ne: true } } as const;

/** Admin dan QA tester boleh melihat course mode preview (semua level, tanpa prasyarat dan drip) untuk mensimulasikannya sebelum dirilis. */
export const isPreviewer = (u: { role: string; qaTester?: boolean | null }) => u.role === "admin" || !!u.qaTester;
/** Course yang dilihat pemeriksa: aktif atau mode preview, tidak diarsipkan, semua level. */
export const PREVIEW_VISIBLE = { archived: { $ne: true }, $or: [{ active: true }, { previewMode: true }] };

/**
 * Materi yang hanya dipakai course mode preview (tidak ada di course yang sudah tayang). Disembunyikan dari peserta di perpustakaan
 * materi dan lewat tautan langsung, supaya isi course yang belum dirilis tidak terlihat lebih awal.
 */
export async function previewOnlyMaterialIds(): Promise<Types.ObjectId[]> {
  const [prev, live] = await Promise.all([Course.find({ previewMode: true, archived: { $ne: true } }).select("_id").lean(), Course.find(LIVE).select("_id").lean()]);
  if (!prev.length) return [];
  const [pu, lu] = await Promise.all([
    Unit.find({ courseId: { $in: prev.map((c) => c._id) } }).select("materialIds").lean(),
    live.length ? Unit.find({ courseId: { $in: live.map((c) => c._id) } }).select("materialIds").lean() : [],
  ]);
  const inLive = new Set(lu.flatMap((u) => u.materialIds.map(String)));
  const ids = new Map<string, Types.ObjectId>();
  for (const u of pu) for (const m of u.materialIds) if (!inLive.has(String(m))) ids.set(String(m), m);
  return [...ids.values()];
}

const DAY = 86_400_000;

/** Drip content: unit terbuka N hari setelah peserta memulai course. Sebelum course dimulai, hanya unit tanpa jeda yang terbuka. */
export function unitDrip(days: number, startedAt: Date | null, now = new Date()) {
  if (!days || days <= 0) return { locked: false, opensAt: null as Date | null };
  if (!startedAt) return { locked: true, opensAt: null as Date | null };
  const opensAt = new Date(startedAt.getTime() + days * DAY);
  return { locked: now < opensAt, opensAt };
}

/** Prasyarat tidak boleh melingkar: tolak diri sendiri dan siklus. `edges` memetakan course ke prasyaratnya. */
export function hasCycle(courseId: string, prereqs: string[], edges: Map<string, string[]>) {
  const seen = new Set<string>();
  const stack = [...prereqs];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === courseId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(edges.get(cur) ?? []));
  }
  return false;
}

type CourseLite = { _id: Types.ObjectId; prerequisiteCourseIds?: Types.ObjectId[] };

/** Status kunci tiap course untuk seorang peserta. Prasyarat yang diarsipkan, nonaktif, atau tanpa unit tidak menghalangi. */
export async function courseLocks(userId: Types.ObjectId | string, courses: CourseLite[]) {
  const out = new Map<string, { locked: boolean; missing: string[] }>();
  const ids = [...new Set(courses.flatMap((c) => (c.prerequisiteCourseIds ?? []).map(String)))];
  if (!ids.length) { for (const c of courses) out.set(String(c._id), { locked: false, missing: [] }); return out; }
  const [pre, units] = await Promise.all([
    Course.find({ _id: { $in: ids }, ...LIVE }).select("title requireSectionTest sectionTestId").lean(),
    Unit.find({ courseId: { $in: ids }, active: true }).select("courseId").lean(),
  ]);
  const prog = await UnitProgress.find({ userId, unitId: { $in: units.map((u) => u._id) }, status: "completed" }).select("unitId").lean();
  const done = new Set(prog.map((p) => String(p.unitId)));
  const title = new Map(pre.map((c) => [String(c._id), c.title]));
  // Course dengan ujian per bagian wajib: selesai hanya bila semua unit selesai DAN ujiannya lulus.
  const needTest = pre.filter((c) => c.requireSectionTest && c.sectionTestId).map((c) => c._id);
  const passedTest = new Set(needTest.length ? (await CourseProgress.find({ userId, courseId: { $in: needTest }, sectionTestPassed: true }).select("courseId").lean()).map((p) => String(p.courseId)) : []);
  const required = new Set(needTest.map(String));
  const complete = (id: string) => {
    const us = units.filter((u) => String(u.courseId) === id);
    const unitsOk = us.length === 0 || us.every((u) => done.has(String(u._id)));
    return unitsOk && (!required.has(id) || passedTest.has(id));
  };
  for (const c of courses) {
    const missing = (c.prerequisiteCourseIds ?? []).map(String).filter((id) => title.has(id) && !complete(id)).map((id) => title.get(id)!);
    out.set(String(c._id), { locked: missing.length > 0, missing });
  }
  return out;
}

/** Saat peserta pertama kali memulai course (progres unit tertua), dasar hitungan drip. */
export async function courseStartedAt(userId: Types.ObjectId | string, courseId: Types.ObjectId | string) {
  const p = await UnitProgress.findOne({ userId, courseId }).sort({ createdAt: 1 }).select("createdAt").lean();
  return (p as { createdAt?: Date } | null)?.createdAt ?? null;
}

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Bolehkah peserta membuka unit ini sekarang? Memeriksa prasyarat course dan drip unit. */
export async function unitAccess(userId: Types.ObjectId | string, unit: { courseId: Types.ObjectId; unlockAfterDays?: number | null }, course: CourseLite) {
  const lock = (await courseLocks(userId, [course])).get(String(course._id));
  if (lock?.locked) return { ok: false as const, reason: `Finish ${lock.missing.join(", ")} first to open this course.` };
  const drip = unitDrip(unit.unlockAfterDays ?? 0, await courseStartedAt(userId, unit.courseId));
  if (drip.locked) return { ok: false as const, reason: drip.opensAt ? `This unit opens on ${fmt(drip.opensAt)}.` : "This unit opens some days after you start the course. Begin with the first unit." };
  return { ok: true as const, reason: "" };
}

export async function assertUnitAccess(userId: Types.ObjectId | string, unit: { courseId: Types.ObjectId; unlockAfterDays?: number | null }, course: CourseLite) {
  const a = await unitAccess(userId, unit, course);
  if (!a.ok) throw new HttpError(403, a.reason, "locked");
}

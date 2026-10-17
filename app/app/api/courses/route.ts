import { LIVE, PREVIEW_VISIBLE, isPreviewer, courseLocks, courseStartedAt, unitDrip } from "@/lib/course-access";
import { getLevels } from "@/lib/config";
import { cycleState, placementNeeded } from "@/lib/cycles";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Course, CourseModule, Unit, UnitProgress } from "@/models/Course";

export const dynamic = "force-dynamic";

/** Course di level peserta beserta unit dan progresnya. Level lain tidak terlihat. */
export async function GET() {
  try {
    const me = await requireRole(["participant", "admin"]);
    await connectDB();
    const preview = isPreviewer(me); // admin dan QA tester: semua level, termasuk course mode preview, tanpa prasyarat dan drip
    if (!preview && (!me.currentLevelId || placementNeeded(me, await cycleState(me.institutionId)))) return NextResponse.json({ needsPlacement: true, courses: [] });
    const levels = preview ? await getLevels() : [];
    const lvl = new Map(levels.map((l) => [String(l._id), l]));
    const found = await Course.find(preview ? { ...PREVIEW_VISIBLE } : { levelId: me.currentLevelId, ...LIVE }).sort({ order: 1, createdAt: 1 }).lean();
    const courses = preview ? found.sort((a, b) => (lvl.get(String(a.levelId))?.order ?? 99) - (lvl.get(String(b.levelId))?.order ?? 99)) : found;
    const units = await Unit.find({ courseId: { $in: courses.map((c) => c._id) }, active: true }).sort({ order: 1, createdAt: 1 }).lean();
    const [mods, locks] = await Promise.all([
      CourseModule.find({ courseId: { $in: courses.map((c) => c._id) }, active: true }).sort({ order: 1, createdAt: 1 }).lean(),
      preview ? new Map<string, { locked: boolean; missing: string[] }>() : courseLocks(me._id, courses),
    ]);
    const started = new Map(await Promise.all(courses.map(async (c) => [String(c._id), await courseStartedAt(me._id, c._id)] as const)));
    const prog = new Map((await UnitProgress.find({ userId: me._id, unitId: { $in: units.map((u) => u._id) } }).lean()).map((p) => [String(p.unitId), p]));
    return NextResponse.json({
      needsPlacement: false, preview,
      courses: courses.map((c) => {
        const us = units.filter((u) => String(u.courseId) === String(c._id)).map((u) => {
          const p = prog.get(String(u._id));
          const total = u.materialIds.length + (u.quizTestId ? 1 : 0);
          const done = (p ? p.materialsDone.filter((m) => u.materialIds.some((x) => String(x) === String(m))).length : 0) + (p?.quizPassed ? 1 : 0);
          const drip = preview ? { locked: false, opensAt: null } : unitDrip(u.unlockAfterDays ?? 0, started.get(String(u.courseId)) ?? null);
          const moduleId = u.moduleId && mods.some((m) => String(m._id) === String(u.moduleId)) ? String(u.moduleId) : null;
          return { id: String(u._id), title: u.title, description: u.description ?? "", moduleId, status: p?.status === "completed" ? "completed" : done > 0 ? "in_progress" : "not_started", done, total, locked: drip.locked, opensAt: drip.opensAt };
        });
        const lock = locks.get(String(c._id));
        return {
          id: String(c._id), title: c.title, description: c.description ?? "", level: preview ? lvl.get(String(c.levelId))?.name ?? null : null, previewOnly: !!c.previewMode, inactive: !c.active, cover: c.coverAssetId ? `/api/assets/${c.coverAssetId}` : null,
          locked: !!lock?.locked, missing: lock?.missing ?? [],
          modules: mods.filter((m) => String(m.courseId) === String(c._id)).map((m) => ({ id: String(m._id), title: m.title, description: m.description ?? "" })),
          units: us, completed: us.filter((u) => u.status === "completed").length,
        };
      }).filter((c) => c.units.length > 0), // course tanpa unit tidak ditampilkan ke peserta
    });
  } catch (e) {
    return handleError(e);
  }
}

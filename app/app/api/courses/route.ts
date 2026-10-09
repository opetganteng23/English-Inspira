import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Course, Unit, UnitProgress } from "@/models/Course";

export const dynamic = "force-dynamic";

/** Course di level peserta beserta unit dan progresnya. Level lain tidak terlihat. */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    if (!me.currentLevelId) return NextResponse.json({ needsPlacement: true, courses: [] });
    const courses = await Course.find({ levelId: me.currentLevelId, active: true }).sort({ order: 1, createdAt: 1 }).lean();
    const units = await Unit.find({ courseId: { $in: courses.map((c) => c._id) }, active: true }).sort({ order: 1, createdAt: 1 }).lean();
    const prog = new Map((await UnitProgress.find({ userId: me._id, unitId: { $in: units.map((u) => u._id) } }).lean()).map((p) => [String(p.unitId), p]));
    return NextResponse.json({
      needsPlacement: false,
      courses: courses.map((c) => {
        const us = units.filter((u) => String(u.courseId) === String(c._id)).map((u) => {
          const p = prog.get(String(u._id));
          const total = u.materialIds.length + (u.quizTestId ? 1 : 0);
          const done = (p ? p.materialsDone.filter((m) => u.materialIds.some((x) => String(x) === String(m))).length : 0) + (p?.quizPassed ? 1 : 0);
          return { id: String(u._id), title: u.title, description: u.description ?? "", status: p?.status === "completed" ? "completed" : done > 0 ? "in_progress" : "not_started", done, total };
        });
        return { id: String(c._id), title: c.title, description: c.description ?? "", units: us, completed: us.filter((u) => u.status === "completed").length };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

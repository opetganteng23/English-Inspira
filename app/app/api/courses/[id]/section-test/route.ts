import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { LIVE, PREVIEW_VISIBLE, isPreviewer, courseLocks } from "@/lib/course-access";
import { courseUnitsComplete } from "@/lib/units";
import { visibleTestFilter } from "@/lib/test-access";
import { cycleState } from "@/lib/cycles";
import { Course } from "@/models/Course";
import { Attempt, Test } from "@/models/Test";

/** Mulai (atau lanjutkan) ujian per bagian milik course. Terbuka setelah semua unit course selesai (admin dan QA tester dikecualikan). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant", "admin"]);
    const preview = isPreviewer(me);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    await connectDB();
    const course = await Course.findOne(preview ? { _id: params.id, ...PREVIEW_VISIBLE } : { _id: params.id, ...LIVE, levelId: me.currentLevelId ?? undefined }).lean();
    if (!course || !course.sectionTestId) throw new HttpError(404, "Section test not found");
    if (!preview) {
      const lock = (await courseLocks(me._id, [course])).get(String(course._id));
      if (lock?.locked) throw new HttpError(403, `Finish ${lock.missing.join(", ")} first to open this course.`, "locked");
      if (!(await courseUnitsComplete(me._id, course._id))) throw new HttpError(403, "Finish every unit of this course to open its section test.", "locked");
      const cs = await cycleState(me.institutionId);
      if (cs.blockedReason) throw new HttpError(403, cs.blockedReason);
    }
    const test = await Test.findOne({ _id: course.sectionTestId, kind: "section", ...visibleTestFilter(me) }).lean();
    if (!test) throw new HttpError(404, "Section test not found");

    const running = await Attempt.findOne({ userId: me._id, testId: test._id, status: "in_progress" });
    if (running) return NextResponse.json({ attemptId: String(running._id), resumed: true });
    if ((test.maxAttempts ?? 0) > 0 && !me.qaTester && !preview) {
      const taken = await Attempt.countDocuments({ userId: me._id, testId: test._id });
      if (taken >= test.maxAttempts!) throw new HttpError(403, `You have used all ${test.maxAttempts} attempt${test.maxAttempts === 1 ? "" : "s"} for this section test.`);
    }
    const now = new Date();
    const cs = await cycleState(me.institutionId);
    const a = await Attempt.create({ userId: me._id, institutionId: me.institutionId, testId: test._id, courseId: course._id, programCycleId: cs.active?._id, kind: "section", startedAt: now, sectionStartedAt: now });
    return NextResponse.json({ attemptId: String(a._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

import { LIVE, PREVIEW_VISIBLE, isPreviewer, assertUnitAccess } from "@/lib/course-access";
import { visibleTestFilter } from "@/lib/test-access";
import { cycleState } from "@/lib/cycles";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Course, Unit } from "@/models/Course";
import { Attempt, Test } from "@/models/Test";

/** Mulai (atau lanjutkan) kuis unit. Kuis hanya bisa dimulai dari unit pemiliknya, pada course di level peserta. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant", "admin"]);
    const preview = isPreviewer(me);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Unit not found");
    await connectDB();
    const unit = await Unit.findOne({ _id: params.id, active: true }).lean();
    const course = unit ? await Course.findOne(preview ? { _id: unit.courseId, ...PREVIEW_VISIBLE } : { _id: unit.courseId, ...LIVE, levelId: me.currentLevelId ?? undefined }).lean() : null;
    if (!unit || !course || !unit.quizTestId) throw new HttpError(404, "Quiz not found");
    if (!preview) await assertUnitAccess(me._id, unit, course);
    const cs = await cycleState(me.institutionId);
    if (cs.blockedReason && !preview) throw new HttpError(403, cs.blockedReason);
    const test = await Test.findOne({ _id: unit.quizTestId, kind: "quiz", ...visibleTestFilter(me) }).lean();
    if (!test) throw new HttpError(404, "Quiz not found");

    const running = await Attempt.findOne({ userId: me._id, testId: test._id, status: "in_progress" });
    if (running) return NextResponse.json({ attemptId: String(running._id), resumed: true });
    const now = new Date();
    const a = await Attempt.create({ userId: me._id, institutionId: me.institutionId, testId: test._id, unitId: unit._id, programCycleId: cs.active?._id, kind: "quiz", startedAt: now, sectionStartedAt: now });
    return NextResponse.json({ attemptId: String(a._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { getParam } from "@/lib/config";
import { Course, Unit, UnitProgress } from "@/models/Course";
import { Material, MaterialProgress } from "@/models/Material";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Detail unit: materi wajib (dengan status), kuis (skor terbaik, lulus, attempt berjalan). Hanya untuk unit di level peserta. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Unit tidak ditemukan");
    await connectDB();
    const unit = await Unit.findOne({ _id: params.id, active: true }).lean();
    const course = unit ? await Course.findOne({ _id: unit.courseId, active: true, levelId: me.currentLevelId ?? undefined }).lean() : null;
    if (!unit || !course) throw new HttpError(404, "Unit tidak ditemukan");

    const [mats, prog, mprog, quiz, running, pass] = await Promise.all([
      Material.find({ _id: { $in: unit.materialIds }, status: "published" }).select("title slug kind summary").lean(),
      UnitProgress.findOne({ userId: me._id, unitId: unit._id }).lean(),
      MaterialProgress.find({ userId: me._id, materialId: { $in: unit.materialIds } }).lean(),
      unit.quizTestId ? Test.findOne({ _id: unit.quizTestId, active: true }).select("name sections").lean() : null,
      unit.quizTestId ? Attempt.findOne({ userId: me._id, testId: unit.quizTestId, status: "in_progress" }).select("_id").lean() : null,
      getParam("unit_pass_score"),
    ]);
    const done = new Set((prog?.materialsDone ?? []).map(String));
    const byId = new Map(mats.map((m) => [String(m._id), m]));
    return NextResponse.json({
      id: String(unit._id), title: unit.title, description: unit.description ?? "", courseTitle: course.title,
      status: prog?.status ?? "not_started", passScore: pass,
      materials: unit.materialIds.map(String).filter((id) => byId.has(id)).map((id) => {
        const m = byId.get(id)!;
        return { id, slug: m.slug, title: m.title, kind: m.kind, summary: m.summary ?? "", done: done.has(id), score: mprog.find((p) => String(p.materialId) === id)?.score ?? null };
      }),
      quiz: quiz ? { name: quiz.name, questions: quiz.sections.reduce((n, s) => n + s.questionIds.length, 0), best: prog?.quizBest ?? null, passed: !!prog?.quizPassed, inProgressAttemptId: running ? String(running._id) : null } : null,
    });
  } catch (e) {
    return handleError(e);
  }
}

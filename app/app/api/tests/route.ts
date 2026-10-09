import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { canStartTest } from "@/lib/test-access";
import { Test, Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin"]);
    await connectDB();
    const [tests, attempts] = await Promise.all([
      Test.find({ active: true, kind: { $ne: "quiz" } }).sort({ createdAt: 1 }).lean(), // kuis tampil di unit belajar
      Attempt.find({ userId: user._id }).select("testId status scoreEst finishedAt").sort({ createdAt: -1 }).lean(),
    ]);
    return NextResponse.json({
      tests: tests.map((t) => {
        const mine = attempts.filter((a) => String(a.testId) === String(t._id));
        const gate = canStartTest(user, t);
        return {
          id: String(t._id), name: t.name, kind: t.kind,
          totalQuestions: t.sections.reduce((n, s) => n + s.questionIds.length, 0),
          totalSec: t.sections.reduce((n, s) => n + s.durationSec, 0),
          unlocked: gate.ok, reason: gate.reason ?? null,
          inProgressAttemptId: String(mine.find((a) => a.status === "in_progress")?._id ?? "") || null,
          lastScore: mine.find((a) => a.status === "submitted")?.scoreEst ?? null,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

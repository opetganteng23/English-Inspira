import { NextResponse } from "next/server";
import { exemptFromDelay } from "@/lib/attempt-release";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { canStartTest, visibleTestFilter } from "@/lib/test-access";
import { cycleState, placementNeeded } from "@/lib/cycles";
import { Test, Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin"]);
    await connectDB();
    const cs = await cycleState(user.institutionId);
    const pendingRel = exemptFromDelay(user) ? null : await Attempt.exists({ userId: user._id, kind: "placement", status: "submitted", releaseAt: { $gt: new Date() } });
    const ctx = { blocked: cs.blockedReason, placementNeeded: placementNeeded(user, cs), pendingRelease: pendingRel ? new Date() : null };
    const [tests, attempts] = await Promise.all([
      Test.find({ ...visibleTestFilter(user), kind: { $ne: "quiz" } }).sort({ createdAt: 1 }).lean(), // kuis tampil di unit belajar
      Attempt.find({ userId: user._id }).select("testId status scoreEst finishedAt releaseAt").sort({ createdAt: -1 }).lean(),
    ]);
    return NextResponse.json({
      tests: tests.map((t) => {
        const mine = attempts.filter((a) => String(a.testId) === String(t._id));
        const gate = canStartTest(user, t, ctx);
        return {
          id: String(t._id), name: t.name, kind: t.kind, testMode: !!t.testMode,
          totalQuestions: t.sections.reduce((n, s) => n + s.questionIds.length, 0),
          totalSec: t.sections.reduce((n, s) => n + s.durationSec, 0),
          unlocked: gate.ok, reason: gate.reason ?? null,
          inProgressAttemptId: String(mine.find((a) => a.status === "in_progress")?._id ?? "") || null,
          lastScore: mine.find((a) => a.status === "submitted" && (!a.releaseAt || a.releaseAt <= new Date()))?.scoreEst ?? null,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

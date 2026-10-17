import { NextResponse } from "next/server";
import { exemptFromDelay, pendingEffectsFilter } from "@/lib/attempt-release";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { canStartTest, visibleTestFilter } from "@/lib/test-access";
import { cycleState, placementNeeded } from "@/lib/cycles";
import { Test, Attempt } from "@/models/Test";
import { seatsFor } from "@/lib/schedule-db";
import { scheduleGate, fmtWindow } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin"]);
    await connectDB();
    const cs = await cycleState(user.institutionId);
    const pendingRel = exemptFromDelay(user) ? null : await Attempt.exists({ userId: user._id, kind: "placement", status: "submitted", ...pendingEffectsFilter });
    const ctx = { blocked: cs.blockedReason, placementNeeded: placementNeeded(user, cs), pendingRelease: pendingRel ? new Date() : null };
    const [tests, attempts] = await Promise.all([
      Test.find({ ...visibleTestFilter(user), kind: { $ne: "quiz" } }).sort({ createdAt: 1 }).lean(), // kuis tampil di unit belajar
      Attempt.find({ userId: user._id }).select("testId status scoreEst finishedAt releaseAt").sort({ createdAt: -1 }).lean(),
    ]);
    const seats = await seatsFor(user._id, tests.filter((t) => t.scheduled).map((t) => t._id));
    const now = new Date();
    return NextResponse.json({
      tests: tests.filter((t) => scheduleGate(t, user, seats.get(String(t._id)) ?? null, now).visible).map((t) => {
        const sched = scheduleGate(t, user, seats.get(String(t._id)) ?? null, now);
        const mine = attempts.filter((a) => String(a.testId) === String(t._id));
        const base = canStartTest(user, t, ctx);
        const gate = !base.ok ? base : sched.ok ? base : { ok: false, reason: sched.reason };
        return {
          id: String(t._id), name: t.name, kind: t.kind, testMode: !!t.testMode,
          totalQuestions: t.sections.reduce((n, s) => n + s.questionIds.length, 0),
          totalSec: t.sections.reduce((n, s) => n + s.durationSec, 0),
          unlocked: gate.ok, reason: gate.reason ?? null,
          schedule: t.scheduled && sched.window ? { state: sched.state, label: sched.label ?? null, opensAt: sched.window.opensAt, closesAt: sched.window.closesAt, text: fmtWindow(sched.window) } : null,
          inProgressAttemptId: String(mine.find((a) => a.status === "in_progress")?._id ?? "") || null,
          lastScore: mine.find((a) => a.status === "submitted" && (!a.releaseAt || a.releaseAt <= new Date()))?.scoreEst ?? null,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

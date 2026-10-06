import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Test, Attempt } from "@/models/Test";
import { accessSummary } from "@/lib/entitlements";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const tests = await Test.find({ active: true }).lean();
    const access = await accessSummary(user._id);
    const attempts = await Attempt.find({ userId: user._id })
      .select("testId status scoreEst finishedAt").sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      tests: tests.map((t) => {
        const mine = attempts.filter((a) => String(a.testId) === String(t._id));
        return {
          id: String(t._id), name: t.name, kind: t.kind,
          totalQuestions: t.sections.reduce((n, s) => n + s.questionIds.length, 0),
          totalSec: t.sections.reduce((n, s) => n + s.durationSec, 0),
          unlocked: t.kind === "trial" || user.role === "admin" || (access.tests[t.kind] ?? 0) > 0,
          remaining: t.kind === "trial" ? null : access.tests[t.kind] ?? 0,
          inProgressAttemptId: String(mine.find((a) => a.status === "in_progress")?._id ?? "") || null,
          lastScore: mine.find((a) => a.status === "submitted")?.scoreEst ?? null,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";

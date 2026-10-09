import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { getLevels } from "@/lib/config";
import { counselorAccess } from "@/lib/counselor-access";
import { User } from "@/models/User";
import { Attempt, Test } from "@/models/Test";
import { CoachingQuota } from "@/models/Config";
import { Institution } from "@/models/Institution";
import { PlanItem, TopicStat } from "@/models/Learning";
import { levelUpStatus } from "@/lib/level-up";

export const dynamic = "force-dynamic";

/** Beranda peserta: level, skor, kuota coaching, langkah berikutnya, dan riwayat skor. (Study plan & jadwal coaching: Fase 5-6.) */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    const [u, levels, attempts, quota, inProgress, inst, counselor, plan, weak, levelUp] = await Promise.all([
      User.findById(me._id).lean(), getLevels(),
      Attempt.find({ userId: me._id, status: "submitted" }).sort({ finishedAt: 1 }).select("kind scoreEst sectionScores finishedAt testId").lean(),
      CoachingQuota.findOne({ userId: me._id, active: true }).lean(),
      Attempt.findOne({ userId: me._id, status: "in_progress" }).select("_id").lean(),
      me.institutionId ? Institution.findById(me.institutionId).select("name contractEnd").lean() : null,
      counselorAccess(me._id),
      PlanItem.find({ userId: me._id, status: { $in: ["active", "late"] } }).sort({ priority: 1, dueAt: 1 }).lean(),
      TopicStat.find({ userId: me._id, status: { $in: ["priority", "weak"] } }).sort({ score: 1 }).limit(5).lean(),
      levelUpStatus(me._id),
    ]);
    const tests = new Map((await Test.find({ _id: { $in: attempts.map((a) => a.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const level = levels.find((l) => String(l._id) === String(u?.currentLevelId));
    const next = level ? levels.find((l) => l.order === level.order + 1) : undefined;
    const last = attempts[attempts.length - 1];

    // Langkah berikutnya mengikuti kondisi nyata akun (urutan prioritas).
    let step: { title: string; body: string; cta: string; href: string } | null = null;
    if (inProgress) step = { title: "Continue your test", body: "You have a test in progress. Its time keeps running on the server.", cta: "Continue", href: `/ruang-tes/${inProgress._id}` };
    else if (!u?.placementAttemptId) step = { title: "Start with the placement test", body: "Taken once, in ITP format. The result sets your level, coaching quota, and initial study plan.", cta: "Start placement", href: "/tes" };
    else step = { title: "Keep learning", body: "Do exercises or simulations to track your progress.", cta: "Open tests", href: "/tes" };

    return NextResponse.json({
      name: u?.name ?? null, institution: inst ? { name: inst.name, contractEnd: inst.contractEnd ?? null } : null,
      level: level ? { name: level.name, scoreMin: level.scoreMin, scoreMax: level.scoreMax } : null, nextLevel: next ? { name: next.name, scoreMin: next.scoreMin } : null,
      scoreEst: u?.currentScoreEst ?? null, gapToNext: next && u?.currentScoreEst != null ? Math.max(0, next.scoreMin - u.currentScoreEst) : null,
      quota: quota ? { used: quota.used, total: quota.total, left: Math.max(0, quota.total - quota.used) } : null,
      counselor: { used: counselor.used, quota: counselor.quota, remaining: counselor.remaining },
      step,
      levelUp,
      plan: plan.map((p) => ({ id: String(p._id), title: p.title, priority: p.priority, source: p.source, dueAt: p.dueAt ?? null, late: p.status === "late", unitId: p.unitId ? String(p.unitId) : null })),
      weakTopics: weak.map((w) => ({ skill: w.skill, topic: w.topic, score: Math.round(w.score), status: w.status })),
      progress: attempts.map((a) => ({ id: String(a._id), name: tests.get(String(a.testId)) ?? "-", kind: a.kind, score: a.scoreEst, at: a.finishedAt })),
      last: last ? { id: String(last._id), name: tests.get(String(last.testId)) ?? "-", score: last.scoreEst, delta: attempts.length > 1 ? (last.scoreEst ?? 0) - (attempts[attempts.length - 2].scoreEst ?? 0) : null, sections: last.sectionScores } : null,
    });
  } catch (e) {
    return handleError(e);
  }
}

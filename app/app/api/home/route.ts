import { NextResponse } from "next/server";
import { releasedFilter, fmtRelease, pendingEffectsFilter, isOrgHold } from "@/lib/attempt-release";
import { LEARNING_TOPIC_FILTER } from "@/lib/topics";
import { cycleState, placementNeeded } from "@/lib/cycles";
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
import { visibleTestFilter } from "@/lib/test-access";
import { seatsFor } from "@/lib/schedule-db";
import { scheduleGate, pickGated } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** Beranda peserta: level, skor, kuota coaching, langkah berikutnya, dan riwayat skor. (Study plan & jadwal coaching: Fase 5-6.) */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    const [u, levels, attempts, quota, inProgress, inst, counselor, plan, weak, levelUp] = await Promise.all([
      User.findById(me._id).lean(), getLevels(),
      Attempt.find({ userId: me._id, status: "submitted", kind: { $nin: ["quiz", "section"] }, ...releasedFilter() }).sort({ finishedAt: 1 }).select("kind scoreEst sectionScores finishedAt testId").lean(),
      CoachingQuota.findOne({ userId: me._id, active: true }).lean(),
      Attempt.findOne({ userId: me._id, status: "in_progress" }).select("_id").lean(),
      me.institutionId ? Institution.findById(me.institutionId).select("name contractEnd").lean() : null,
      counselorAccess(me._id),
      PlanItem.find({ userId: me._id, status: { $in: ["active", "late"] } }).sort({ priority: 1, dueAt: 1 }).lean(),
      TopicStat.find({ userId: me._id, status: { $in: ["priority", "weak"] }, ...LEARNING_TOPIC_FILTER }).sort({ score: 1 }).limit(5).lean(),
      levelUpStatus(me._id),
    ]);
    const tests = new Map((await Test.find({ _id: { $in: attempts.map((a) => a.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const level = levels.find((l) => String(l._id) === String(u?.currentLevelId));
    const next = level ? levels.find((l) => l.order === level.order + 1) : undefined;
    const last = attempts[attempts.length - 1];

    const cs = await cycleState(u?.institutionId);
    // Hasil yang masih ditahan: skor belum terlihat; placement dianggap sudah dikerjakan agar peserta tidak mengulang.
    const held = await Attempt.findOne({ userId: me._id, status: "submitted", ...pendingEffectsFilter }).sort({ releaseAt: 1 }).select("releaseAt kind").lean();
    const needPlace = (!u?.placementAttemptId || placementNeeded(u, cs)) && held?.kind !== "placement";
    // Bisa ada beberapa varian placement (tes terjadwal per kelompok): pilih yang memang dijadwalkan atau terbuka untuk peserta ini.
    const candidates = needPlace ? await Test.find({ kind: "placement", ...visibleTestFilter(u ?? { role: "participant" }) }).sort({ testMode: -1, createdAt: 1 }).select("_id scheduled").lean() : [];
    const seats = await seatsFor(me._id, candidates.filter((t) => t.scheduled).map((t) => t._id));
    const picked = pickGated(candidates.map((t) => ({ test: t, gate: scheduleGate(t, me, seats.get(String(t._id)) ?? null) })));
    const placementTest = picked?.test ?? null;
    const placeGate = candidates.length ? (picked?.gate ?? { visible: false, ok: false }) : null; // ada placement, tetapi tidak satupun dijadwalkan untuk peserta ini
    // Langkah berikutnya mengikuti kondisi nyata akun (urutan prioritas).
    let step: { title: string; body: string; cta: string; href: string } | null = null;
    if (inProgress) step = { title: "Continue your test", body: "You have a test in progress. Its time keeps running on the server.", cta: "Continue", href: `/test-room/${inProgress._id}` };
    else if (held && isOrgHold(held.releaseAt)) step = { title: "Test submitted", body: "Your test has been received. Results will be announced by the program organizer.", cta: "View status", href: `/results/${held._id}` };
    else if (held) step = { title: held.releaseAt! > new Date() ? "Your result is being prepared" : "Your result is ready", body: held.releaseAt! > new Date() ? `Results are released at ${fmtRelease(held.releaseAt!)}. Come back then to see your score, level, and analysis.` : "Your result is ready. Open it to see your score, level, and analysis.", cta: "View status", href: `/results/${held._id}` };
    else if (cs.blockedReason) step = { title: "Program period closed", body: cs.blockedReason, cta: "Open learning", href: "/learn" };
    else if (needPlace && placeGate && !placeGate.visible) step = { title: "Your placement test is not scheduled yet", body: "Your placement test is taken in a scheduled session. You will receive an email with the date and time.", cta: "Open learning", href: "/learn" };
    else if (needPlace && placeGate && !placeGate.ok) step = { title: placeGate.state === "upcoming" ? "Your placement test is scheduled" : "Your placement session has closed", body: placeGate.reason ?? "", cta: "Open tests", href: "/tests" };
    else if (needPlace) step = { title: "Start with the placement test", body: "Taken once per program period, in EPTA format. The result sets your level, coaching quota, and initial study plan.", cta: "Start placement", href: placementTest ? `/tests/prepare/${placementTest._id}` : "/tests" };
    else step = { title: "Keep learning", body: "Do exercises or simulations to track your progress.", cta: "Open tests", href: "/tests" };

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

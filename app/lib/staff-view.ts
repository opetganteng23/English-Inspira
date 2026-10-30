import { isValidObjectId } from "mongoose";
import { connectDB } from "./db";
import { HttpError, requireRole, ACADEMIC_ROLES } from "./rbac";
import { getLevels } from "./config";
import { releasedFilter, isReleased } from "./attempt-release";
import { LEARNING_TOPIC_FILTER } from "./topics";
import { levelUpStatus } from "./level-up";
import { counselorAccess } from "./counselor-access";
import { getFeatures } from "./features";
import { audit } from "./audit";
import { ageOf } from "./age";
import { User } from "@/models/User";
import { Attempt, Test } from "@/models/Test";
import { Institution } from "@/models/Institution";
import { CoachingQuota } from "@/models/Config";
import { PlanItem, TopicStat } from "@/models/Learning";
import { SessionNote } from "@/models/Coaching";

/**
 * Siapa boleh melihat data lengkap seorang peserta:
 * - admin pusat / admin akademik: semua peserta, termasuk hasil yang belum dirilis (`full`);
 * - admin institusi: hanya peserta institusinya, dan hanya hasil yang sudah dirilis (mengikuti Hold dan jam rilis).
 */
export async function staffViewer(participantId: string) {
  const viewer = await requireRole([...ACADEMIC_ROLES, "inst_admin"]);
  if (!isValidObjectId(participantId)) throw new HttpError(404, "Participant not found");
  await connectDB();
  const target = await User.findOne({ _id: participantId, role: "participant" }).lean();
  if (!target) throw new HttpError(404, "Participant not found");
  if (viewer.role === "inst_admin" && String(target.institutionId ?? "") !== String(viewer.institutionId ?? "")) throw new HttpError(404, "Participant not found");
  // Admin institusi ikut tertahan kecuali institusinya mengatur penahanan hanya untuk peserta.
  const full = viewer.role !== "inst_admin" || (await Institution.findById(viewer.institutionId).select("holdFromInstAdmin").lean())?.holdFromInstAdmin === false;
  return { viewer, target, full };
}

/** Dasbor lengkap peserta untuk staf: sama dengan beranda peserta, ditambah riwayat semua tes dan topik kuat/lemah. */
export async function staffDashboard(participantId: string) {
  const { viewer, target: u, full } = await staffViewer(participantId);
  const visible = full ? {} : releasedFilter();
  const [levels, attempts, quota, inst, counselor, plan, weak, strong, levelUp, inProgress, notes] = await Promise.all([
    getLevels(),
    Attempt.find({ userId: u._id, status: "submitted", ...visible }).sort({ finishedAt: 1 }).select("kind scoreEst sectionScores finishedAt startedAt testId releaseAt releasedAt heldByOrg proctorFlags").lean(),
    CoachingQuota.findOne({ userId: u._id, active: true }).lean(),
    u.institutionId ? Institution.findById(u.institutionId).select("name contractEnd").lean() : null,
    counselorAccess(u._id),
    PlanItem.find({ userId: u._id, status: { $in: ["active", "late"] } }).sort({ priority: 1, dueAt: 1 }).lean(),
    TopicStat.find({ userId: u._id, status: { $in: ["priority", "weak"] }, ...LEARNING_TOPIC_FILTER }).sort({ score: 1 }).limit(10).lean(),
    TopicStat.find({ userId: u._id, status: "strong", ...LEARNING_TOPIC_FILTER }).sort({ score: -1 }).limit(8).lean(),
    levelUpStatus(u._id),
    Attempt.findOne({ userId: u._id, status: "in_progress" }).select("startedAt testId").lean(),
    // Catatan coach (untuk peserta dan internal): admin pusat dan pimpinan institusi peserta.
    SessionNote.find({ userId: u._id }).sort({ updatedAt: -1 }).limit(20).select("coachId shared private recommendLevelUp updatedAt").lean(),
  ]);
  const coaches = new Map((await User.find({ _id: { $in: notes.map((n) => n.coachId) } }).select("name email").lean()).map((c) => [String(c._id), c.name ?? c.email]));
  // Admin institusi tidak melihat hasil yang masih ditahan/menunggu jam rilis; jumlahnya tetap diberitahukan.
  const hiddenHeld = full ? 0 : await Attempt.countDocuments({ userId: u._id, status: "submitted", releaseAt: { $gt: new Date() } });
  const tests = new Map((await Test.find({ _id: { $in: [...attempts.map((a) => a.testId), ...(inProgress ? [inProgress.testId] : [])] } }).select("name").lean()).map((t) => [String(t._id), t.name]));
  const scored = attempts.filter((a) => a.kind !== "quiz" && a.kind !== "section");
  const last = scored[scored.length - 1];
  const fromScore = (s: number) => levels.find((l) => s >= l.scoreMin && s <= l.scoreMax);
  const level = levels.find((l) => String(l._id) === String(u.currentLevelId)) ?? (full && last?.scoreEst != null ? fromScore(last.scoreEst) : undefined);
  const scoreEst = u.currentScoreEst ?? (full ? last?.scoreEst ?? null : null);
  const next = level ? levels.find((l) => l.order === level.order + 1) : undefined;
  await audit(viewer._id, "participant.dashboard_view", String(u._id), { role: viewer.role });
  return {
    viewer: { role: viewer.role, full },
    profile: { id: String(u._id), name: u.name ?? null, email: u.email, status: u.status, phone: u.phone ?? null, targetScore: u.targetScore ?? null, goal: u.goal ?? null, lastLoginAt: u.lastLoginAt ?? null, joinedAt: u.createdAt ?? null, institution: inst ? { name: inst.name, contractEnd: inst.contractEnd ?? null } : null,
      // Data diri dari impor HR (NDA): hanya admin pusat dan admin institusi; NIK tidak disimpan.
      personal: viewer.role === "admin" || viewer.role === "inst_admin" ? { gender: u.gender ?? null, birthPlace: u.birthPlace ?? null, birthDate: u.birthDate ?? null, age: ageOf(u.birthDate), employmentStatus: u.employmentStatus ?? null, jobTitle: u.jobTitle ?? null, branch: u.branch ?? null, city: u.city ?? null, province: u.province ?? null, education: u.education ?? null } : null },
    level: level ? { name: level.name, scoreMin: level.scoreMin, scoreMax: level.scoreMax } : null,
    nextLevel: next ? { name: next.name, scoreMin: next.scoreMin } : null,
    levelProvisional: !u.currentLevelId && !!level,
    scoreEst, gapToNext: next && scoreEst != null ? Math.max(0, next.scoreMin - scoreEst) : null,
    quota: quota ? { used: quota.used, total: quota.total, left: Math.max(0, quota.total - quota.used) } : null,
    counselor: (await getFeatures()).aiCounselor ? { used: counselor.used, quota: counselor.quota, remaining: counselor.remaining } : null,
    levelUp, hiddenHeld,
    coachNotes: notes.filter((n) => n.shared || n.private).map((n) => ({ id: String(n._id), coach: coaches.get(String(n.coachId)) ?? "-", shared: n.shared ?? null, private: n.private ?? null, recommendLevelUp: !!n.recommendLevelUp, at: n.updatedAt })),
    inProgress: inProgress ? { test: tests.get(String(inProgress.testId)) ?? "-", startedAt: inProgress.startedAt } : null,
    plan: plan.map((p) => ({ id: String(p._id), title: p.title, priority: p.priority, source: p.source, dueAt: p.dueAt ?? null, late: p.status === "late" })),
    weakTopics: weak.map((w) => ({ skill: w.skill, topic: w.topic, score: Math.round(w.score), status: w.status })),
    strongTopics: strong.map((w) => ({ skill: w.skill, topic: w.topic, score: Math.round(w.score) })),
    progress: scored.map((a) => ({ id: String(a._id), name: tests.get(String(a.testId)) ?? "-", kind: a.kind, score: a.scoreEst, at: a.finishedAt })),
    last: last ? { id: String(last._id), name: tests.get(String(last.testId)) ?? "-", score: last.scoreEst, delta: scored.length > 1 ? (last.scoreEst ?? 0) - (scored[scored.length - 2].scoreEst ?? 0) : null, sections: last.sectionScores, released: isReleased(last) } : null,
    attempts: [...attempts].reverse().map((a) => ({
      id: String(a._id), name: tests.get(String(a.testId)) ?? "-", kind: a.kind, score: a.scoreEst ?? null, finishedAt: a.finishedAt ?? null,
      minutes: a.startedAt && a.finishedAt ? Math.round((+a.finishedAt - +a.startedAt) / 60000) : null,
      sections: (a.sectionScores ?? []).map((s) => ({ section: s.section, raw: s.raw, total: s.total, scaled: s.scaled })),
      released: isReleased(a), held: !!a.heldByOrg && !a.releasedAt, flags: (a.proctorFlags ?? []).length,
    })),
  };
}

import type { HydratedDocument, Types } from "mongoose";
import { connectDB } from "./db";
import { getLevels, getParam } from "./config";
import { audit } from "./audit";
import { enqueueMail } from "./mailq";
import { refreshStudyPlan } from "./study-plan";
import { User } from "@/models/User";
import { CoachingQuota } from "@/models/Config";
import { Analysis, PlanItem, TopicStat } from "@/models/Learning";
import { SessionNote } from "@/models/Coaching";
import type { AttemptDoc } from "@/models/Test";

export type LevelUpRules = { requireRemedialDone: boolean; minSimScoreFromNextLevel: boolean };

/**
 * Keputusan naik level (MTS §12), murni: skor simulasi ≥ batas bawah level berikutnya DAN remedial prioritas tinggi selesai.
 * Rekomendasi coach membebaskan syarat remedial (tidak membebaskan syarat skor).
 */
export function levelUpDecision(i: { score: number | null; nextMin: number | null; remedialPending: number; coachRecommends: boolean; rules: LevelUpRules }) {
  const reasons: string[] = [];
  if (i.nextMin == null) return { up: false, reasons: ["Sudah di level tertinggi"] };
  if (i.score == null) reasons.push("Belum ada skor simulasi");
  else if (i.rules.minSimScoreFromNextLevel && i.score < i.nextMin) reasons.push(`Skor simulasi ${i.score} belum mencapai ${i.nextMin}`);
  if (i.rules.requireRemedialDone && i.remedialPending > 0 && !i.coachRecommends) reasons.push(`${i.remedialPending} item remedial prioritas tinggi belum selesai`);
  return { up: reasons.length === 0, reasons };
}

async function gather(userId: Types.ObjectId | string, score: number | null) {
  const [levels, rules, user] = await Promise.all([getLevels(), getParam("level_up"), User.findById(userId)]);
  if (!user) return null;
  const cur = levels.find((l) => String(l._id) === String(user.currentLevelId));
  const next = cur ? levels.find((l) => l.order === cur.order + 1) : undefined;
  const [pending, rec] = await Promise.all([
    PlanItem.countDocuments({ userId, status: "active", priority: "high", source: "auto" }),
    SessionNote.exists({ userId, recommendLevelUp: true, updatedAt: { $gte: new Date(Date.now() - 60 * 86_400_000) } }),
  ]);
  const decision = levelUpDecision({ score, nextMin: next?.scoreMin ?? null, remedialPending: pending, coachRecommends: !!rec, rules });
  return { user, cur, next, decision, levels };
}

/** Status live untuk Beranda: sudah memenuhi syarat atau apa yang kurang (tanpa efek samping). */
export async function levelUpStatus(userId: Types.ObjectId | string) {
  await connectDB();
  const u = await User.findById(userId).select("currentScoreEst").lean();
  const g = await gather(userId, u?.currentScoreEst ?? null);
  return g ? { nextLevel: g.next?.name ?? null, ...g.decision } : null;
}

/**
 * Setelah simulasi selesai: naikkan level bila memenuhi syarat. Naik level memberi kuota coaching baru sesuai level
 * (kuota lama hangus), dan study plan dibuat ulang dari statistik topik. Idempoten lewat update bersyarat.
 */
export async function evaluateLevelUp(attempt: HydratedDocument<AttemptDoc>) {
  await connectDB();
  if (attempt.kind !== "sim" || attempt.scoreEst == null) return null;
  const g = await gather(attempt.userId, attempt.scoreEst);
  if (!g || !g.cur || !g.next) return g ? { up: false, reasons: g.decision.reasons } : null;
  let result: { up: boolean; reasons: string[]; level?: string } = { up: false, reasons: g.decision.reasons };

  if (g.decision.up) {
    const moved = await User.updateOne(
      { _id: g.user._id, currentLevelId: g.cur._id },
      { currentLevelId: g.next._id, $push: { levelHistory: { levelId: g.next._id, at: new Date(), reason: "level_up" } } }
    );
    if (moved.modifiedCount) {
      await CoachingQuota.updateMany({ userId: g.user._id, active: true }, { active: false });
      if (g.user.institutionId) await CoachingQuota.create({ userId: g.user._id, institutionId: g.user.institutionId, levelId: g.next._id, total: g.next.coachingQuota });
      // Rencana lama milik level sebelumnya ditutup; rencana baru dari topik yang masih lemah.
      await PlanItem.updateMany({ userId: g.user._id, status: "active", source: "auto" }, { status: "resolved", doneAt: new Date() });
      const topics = await TopicStat.find({ userId: g.user._id }).lean();
      await refreshStudyPlan(g.user._id, g.user.institutionId ?? undefined, topics.map((t) => ({ skill: t.skill, topic: t.topic, score: t.score, status: t.status })));
      await enqueueMail(g.user.email, "level_up", { level: g.next.name, quota: g.next.coachingQuota, link: `${process.env.APP_URL ?? "http://localhost:3000"}/beranda` });
      await audit(g.user._id, "level.up", String(attempt._id), { from: g.cur.key, to: g.next.key, score: attempt.scoreEst });
      result = { up: true, reasons: [], level: g.next.name };
    }
  }
  await Analysis.updateOne({ attemptId: attempt._id }, { $set: { "calculated.levelUp": result } });
  return result;
}

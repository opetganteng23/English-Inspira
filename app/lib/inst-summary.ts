import type { Types } from "mongoose";
import { LEARNING_TOPIC_FILTER } from "@/lib/topics";
import { memberResults } from "./inst";
import { getLevels, getParam } from "./config";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { TopicStat, PlanItem } from "@/models/Learning";
import { Booking } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";

/**
 * Ringkasan kelompok untuk admin institusi (MTS §4, §8). HANYA agregat dan indikator perhatian:
 * tanpa isi analisis individu, narasi AI, percakapan Konselor, atau catatan sesi coach.
 */
export async function buildInstSummary(inst: { _id: Types.ObjectId; name: string; code?: string; batch?: string | null; contractEnd?: Date | null; seats: number }, scoped: (f?: Record<string, unknown>) => Record<string, unknown>, full = false) {
  const [members, levels] = await Promise.all([
    User.find(scoped({ role: "participant", status: { $ne: "disabled" }, qaTester: { $ne: true } })).select("name email targetScore status currentLevelId currentScoreEst placementAttemptId lastLoginAt createdAt").lean(),
    getLevels(),
  ]);
  const ids = members.map((m) => m._id);
  const [results, bookings, quotas, weak, late] = await Promise.all([
    memberResults(ids, full),
    Booking.find({ institutionId: inst._id, active: true, status: { $in: ["present", "absent", "excused"] } }).select("status").lean(),
    CoachingQuota.find({ institutionId: inst._id, active: true }).select("total used").lean(),
    TopicStat.aggregate([{ $match: { userId: { $in: ids }, status: { $in: ["weak", "priority"] }, ...LEARNING_TOPIC_FILTER } }, { $group: { _id: "$topic", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }]),
    PlanItem.distinct("userId", { userId: { $in: ids }, status: "late" }),
  ]);

  const active = members.filter((m) => m.status === "active");
  // Sudah mengerjakan placement = level sudah ditetapkan ATAU sudah mengumpulkan placement yang hasilnya masih ditahan/menunggu rilis.
  const [didPlace, heldIds] = await Promise.all([
    Attempt.distinct("userId", { userId: { $in: ids }, kind: "placement", status: "submitted" }),
    Attempt.distinct("userId", { userId: { $in: ids }, kind: "placement", status: "submitted", releasedAt: { $exists: false }, releaseAt: { $gt: new Date() } }),
  ]);
  const didSet = new Set(didPlace.map(String));
  const placed = members.filter((m) => m.placementAttemptId || didSet.has(String(m._id)));
  // Admin pusat: hasil placement yang masih ditahan ikut dihitung (level dari skornya, topik lemah dari rincian topiknya).
  const heldAttempts = full ? await Attempt.find({ userId: { $in: ids }, kind: "placement", status: "submitted", releasedAt: { $exists: false }, releaseAt: { $exists: true } }).sort({ finishedAt: 1 }).select("userId scoreEst topicScores").lean() : [];
  const heldScore = new Map(heldAttempts.map((a) => [String(a.userId), a]));
  const scoreOf = (m: (typeof members)[number]) => m.currentScoreEst ?? heldScore.get(String(m._id))?.scoreEst ?? null;
  const levelOf = (m: (typeof members)[number]) => { if (m.currentLevelId) return String(m.currentLevelId); const sc = heldScore.get(String(m._id))?.scoreEst; const l = typeof sc === "number" ? levels.find((x) => sc >= x.scoreMin && sc <= x.scoreMax) : null; return l ? String(l._id) : null; };
  const dist = levels.map((l) => ({ label: l.name, n: members.filter((m) => levelOf(m) === String(l._id)).length }));
  const withTarget = members.filter((m) => scoreOf(m) != null);
  const reached = withTarget.filter((m) => (scoreOf(m) ?? 0) >= (m.targetScore ?? 500)).length;
  const weakCount = new Map<string, number>(weak.map((w) => [w._id as string, w.n as number]));
  if (heldAttempts.length) {
    const { weak: weakAt, minItems } = await getParam("weakness");
    for (const a of heldScore.values()) for (const t of new Set((a.topicScores ?? []).filter((t) => (t.total ?? 0) >= minItems && (t.score ?? 100) < weakAt).map((t) => t.topic as string))) weakCount.set(t, (weakCount.get(t) ?? 0) + 1);
  }
  const commonWeak = [...weakCount].sort((x, y) => y[1] - x[1]).slice(0, 6);
  const lastScores: number[] = [], firstScores: number[] = [];
  const now = Date.now();
  const attention: { id: string; name: string; reason: string; score: number | null }[] = [];
  for (const m of members) {
    const list = results.get(String(m._id)) ?? [];
    const last = list[list.length - 1], first = list[0];
    if (last?.scoreEst) { lastScores.push(last.scoreEst); if (first?.scoreEst) firstScores.push(first.scoreEst); }
    const name = m.name ?? m.email;
    if (m.status === "invited" && now - +m.createdAt > 7 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Has not activated the account (>7 days since invitation)", score: null });
    else if (m.status === "active" && !m.placementAttemptId && !didSet.has(String(m._id)) && now - +(m.lastLoginAt ?? m.createdAt) > 7 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Has not taken the placement test", score: null });
    else if (m.status === "active" && m.lastLoginAt && now - +m.lastLoginAt > 14 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Inactive for 14 days", score: m.currentScoreEst ?? null });
    else if (list.length > 1 && last.scoreEst != null && (last.scoreEst ?? 0) < (list[list.length - 2].scoreEst ?? 0)) attention.push({ id: String(m._id), name, reason: "Score dropped from the previous test", score: last.scoreEst ?? null });
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const aL = avg(lastScores), aF = avg(firstScores);
  const present = bookings.filter((b) => b.status === "present").length, absent = bookings.filter((b) => b.status === "absent").length;
  const qTotal = quotas.reduce((a, q) => a + q.total, 0), qUsed = quotas.reduce((a, q) => a + q.used, 0);

  return {
    institution: { name: inst.name, code: inst.code ?? "", batch: inst.batch ?? null, contractEnd: inst.contractEnd ?? null, seats: inst.seats },
    registered: members.length, seats: inst.seats, seatsLeft: Math.max(0, inst.seats - members.length), active: active.length, invited: members.length - active.length,
    placementDone: placed.length, placementHeld: heldIds.length, placementPct: members.length ? Math.round((placed.length / members.length) * 100) : null,
    levels: dist, avgEstimate: aL, avgDelta: aL != null && aF != null ? aL - aF : null,
    reachedPct: withTarget.length ? Math.round((reached / withTarget.length) * 100) : null, reached, withScore: withTarget.length,
    coaching: { sessionsMarked: bookings.length, presentPct: bookings.length ? Math.round((present / bookings.length) * 100) : null, absent, quotaUsedPct: qTotal ? Math.round((qUsed / qTotal) * 100) : null },
    planLatePct: active.length ? Math.round((late.length / active.length) * 100) : null, planLate: late.length,
    commonWeaknesses: commonWeak.map(([title, n]) => ({ title, n })), viewerFull: full,
    attention: attention.slice(0, 20),
  };
}

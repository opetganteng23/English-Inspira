import type { Types } from "mongoose";
import { memberResults } from "./inst";
import { getLevels } from "./config";
import { User } from "@/models/User";
import { TopicStat, PlanItem } from "@/models/Learning";
import { Booking } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";

/**
 * Ringkasan kelompok untuk admin institusi (MTS §4, §8). HANYA agregat dan indikator perhatian:
 * tanpa isi analisis individu, narasi AI, percakapan Konselor, atau catatan sesi coach.
 */
export async function buildInstSummary(inst: { _id: Types.ObjectId; name: string; batch?: string | null; contractEnd?: Date | null; seats: number }, scoped: (f?: Record<string, unknown>) => Record<string, unknown>) {
  const [members, levels] = await Promise.all([
    User.find(scoped({ role: "participant", status: { $ne: "disabled" } })).select("name email targetScore status currentLevelId currentScoreEst placementAttemptId lastLoginAt createdAt").lean(),
    getLevels(),
  ]);
  const ids = members.map((m) => m._id);
  const [results, bookings, quotas, weak, late] = await Promise.all([
    memberResults(ids),
    Booking.find({ institutionId: inst._id, active: true, status: { $in: ["present", "absent", "excused"] } }).select("status").lean(),
    CoachingQuota.find({ institutionId: inst._id, active: true }).select("total used").lean(),
    TopicStat.aggregate([{ $match: { userId: { $in: ids }, status: { $in: ["weak", "priority"] } } }, { $group: { _id: "$topic", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }]),
    PlanItem.distinct("userId", { userId: { $in: ids }, status: "late" }),
  ]);

  const active = members.filter((m) => m.status === "active");
  const placed = members.filter((m) => m.placementAttemptId);
  const dist = levels.map((l) => ({ label: l.name, n: members.filter((m) => String(m.currentLevelId) === String(l._id)).length }));
  const withTarget = members.filter((m) => m.currentScoreEst != null);
  const reached = withTarget.filter((m) => (m.currentScoreEst ?? 0) >= (m.targetScore ?? 500)).length;
  const lastScores: number[] = [], firstScores: number[] = [];
  const now = Date.now();
  const attention: { id: string; name: string; reason: string; score: number | null }[] = [];
  for (const m of members) {
    const list = results.get(String(m._id)) ?? [];
    const last = list[list.length - 1], first = list[0];
    if (last?.scoreEst) { lastScores.push(last.scoreEst); if (first?.scoreEst) firstScores.push(first.scoreEst); }
    const name = m.name ?? m.email;
    if (m.status === "invited" && now - +m.createdAt > 7 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Belum mengaktifkan akun (>7 hari sejak undangan)", score: null });
    else if (m.status === "active" && !m.placementAttemptId && now - +(m.lastLoginAt ?? m.createdAt) > 7 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Belum mengerjakan placement test", score: null });
    else if (m.status === "active" && m.lastLoginAt && now - +m.lastLoginAt > 14 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Tidak aktif 14 hari", score: m.currentScoreEst ?? null });
    else if (list.length > 1 && (last.scoreEst ?? 0) < (list[list.length - 2].scoreEst ?? 0)) attention.push({ id: String(m._id), name, reason: "Skor turun dari tes sebelumnya", score: last.scoreEst ?? null });
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const aL = avg(lastScores), aF = avg(firstScores);
  const present = bookings.filter((b) => b.status === "present").length, absent = bookings.filter((b) => b.status === "absent").length;
  const qTotal = quotas.reduce((a, q) => a + q.total, 0), qUsed = quotas.reduce((a, q) => a + q.used, 0);

  return {
    institution: { name: inst.name, batch: inst.batch ?? null, contractEnd: inst.contractEnd ?? null, seats: inst.seats },
    registered: members.length, seats: inst.seats, seatsLeft: Math.max(0, inst.seats - members.length), active: active.length, invited: members.length - active.length,
    placementDone: placed.length, placementPct: members.length ? Math.round((placed.length / members.length) * 100) : null,
    levels: dist, avgEstimate: aL, avgDelta: aL != null && aF != null ? aL - aF : null,
    reachedPct: withTarget.length ? Math.round((reached / withTarget.length) * 100) : null, reached, withScore: withTarget.length,
    coaching: { sessionsMarked: bookings.length, presentPct: bookings.length ? Math.round((present / bookings.length) * 100) : null, absent, quotaUsedPct: qTotal ? Math.round((qUsed / qTotal) * 100) : null },
    planLatePct: active.length ? Math.round((late.length / active.length) * 100) : null, planLate: late.length,
    commonWeaknesses: weak.map((w) => ({ title: w._id as string, n: w.n as number })),
    attention: attention.slice(0, 20),
  };
}

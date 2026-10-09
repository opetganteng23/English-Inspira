import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, scopeByInstitution } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getLevels } from "@/lib/config";
import { coachParticipantAction } from "@/lib/coaching-schemas";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { Analysis, PlanItem, TopicStat } from "@/models/Learning";
import { Booking, SessionNote } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";

export const dynamic = "force-dynamic";

/** Peserta HARUS di institusi coach (filter di level query); selain itu 404, sama seperti tidak ada. */
async function participantFor(coach: Parameters<typeof scopeByInstitution>[0], id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Participant not found");
  await connectDB();
  const u = await User.findOne(scopeByInstitution(coach, { _id: id, role: "participant" } as never));
  if (!u) throw new HttpError(404, "Participant not found");
  return u;
}

/** Laporan pra-sesi (MTS §16.4): level, skor, topik, rencana, stuck, riwayat kehadiran, dan catatan sebelumnya. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const coach = await requireRole(["coach"]);
    const u = await participantFor(coach, params.id);
    const [levels, quota, topics, plan, attempts, lastAnalysis, bookings, notes] = await Promise.all([
      getLevels(), CoachingQuota.findOne({ userId: u._id, active: true }).lean(), TopicStat.find({ userId: u._id }).sort({ score: 1 }).lean(),
      PlanItem.find({ userId: u._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Attempt.find({ userId: u._id, status: "submitted" }).sort({ finishedAt: -1 }).limit(8).select("kind scoreEst sectionScores finishedAt").lean(),
      Analysis.findOne({ userId: u._id }).sort({ createdAt: -1 }).select("calculated createdAt").lean(),
      Booking.find({ userId: u._id, active: true }).lean(),
      SessionNote.find({ userId: u._id, coachId: coach._id }).sort({ updatedAt: -1 }).limit(5).lean(),
    ]);
    await audit(coach._id, "participant.view", params.id); // akses coach ke data peserta dicatat (MTS §20)
    const lv = levels.find((l) => String(l._id) === String(u.currentLevelId));
    const next = lv ? levels.find((l) => l.order === lv.order + 1) : undefined;
    const att = (s: string) => bookings.filter((b) => b.status === s).length;
    return NextResponse.json({
      profile: { id: String(u._id), name: u.name ?? null, email: u.email, level: lv?.name ?? null, scoreEst: u.currentScoreEst ?? null, nextLevel: next ? { name: next.name, scoreMin: next.scoreMin } : null, targetScore: u.targetScore ?? null, placementDone: !!u.placementAttemptId, placementRetakeAllowed: u.placementRetakeAllowed },
      quota: quota ? { used: quota.used, total: quota.total } : null,
      attendance: { present: att("present"), absent: att("absent"), excused: att("excused"), upcoming: att("booked") },
      topics: topics.map((t) => ({ skill: t.skill, topic: t.topic, score: Math.round(t.score), items: t.items, status: t.status })),
      stuck: ((lastAnalysis?.calculated as { stuck?: string[] } | undefined)?.stuck ?? []).map((k) => k.split("|")[1] ?? k),
      plan: plan.map((p) => ({ id: String(p._id), title: p.title, priority: p.priority, source: p.source, status: p.status, dueAt: p.dueAt ?? null })),
      attempts: attempts.map((a) => ({ id: String(a._id), kind: a.kind, scoreEst: a.scoreEst, finishedAt: a.finishedAt })),
      notes: notes.map((n) => ({ private: n.private ?? "", shared: n.shared ?? "", recommendLevelUp: !!n.recommendLevelUp, at: n.updatedAt })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Tambah item rencana dari coach (tidak pernah ditimpa sistem) atau izinkan ulang placement. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const coach = await requireRole(["coach"]);
    const u = await participantFor(coach, params.id);
    const b = coachParticipantAction.parse(await req.json());
    if (b.action === "add_plan") {
      await PlanItem.create({ userId: u._id, institutionId: u.institutionId, skill: b.skill, topic: b.topic, title: b.title, priority: "high", source: "coach", dueAt: new Date(Date.now() + b.dueInDays * 86_400_000) });
      await audit(coach._id, "plan.coach_add", params.id, { title: b.title });
    } else {
      if (!u.placementAttemptId) throw new HttpError(409, "The participant has not taken the placement test");
      u.placementRetakeAllowed = true; await u.save();
      await audit(coach._id, "placement.retake_allowed", params.id, { reason: b.reason });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

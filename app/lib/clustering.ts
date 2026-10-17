import type { Types } from "mongoose";
import { connectDB } from "./db";
import { getLevels, levelForScore } from "./config";
import { audit } from "./audit";
import { notify } from "./notify";
import { cycleState } from "./cycles";
import { pickClass } from "./class-pick";
import { EQUIVALENCE_DEFAULT, equivalenceSchema, type Equivalence } from "./score-equivalence";
import { HttpError } from "./rbac";
import { User } from "@/models/User";
import { CoachingQuota } from "@/models/Config";
import { Setting, getSetting } from "@/models/Settings";
import { ClassGroup, ClassMember, ExternalResult, type ExternalResultDoc } from "@/models/Cluster";
import { LearningEvent } from "@/models/Course";

export async function getEquivalence(): Promise<Equivalence> {
  await connectDB();
  const v = await getSetting("score_equivalence", EQUIVALENCE_DEFAULT);
  const ok = equivalenceSchema.safeParse(v);
  return ok.success ? ok.data : EQUIVALENCE_DEFAULT;
}
export async function setEquivalence(v: Equivalence) {
  await connectDB();
  await Setting.updateOne({ key: "score_equivalence" }, { value: v }, { upsert: true });
}

/** Peserta kandidat pencocokan (opsional dibatasi satu institusi). */
export async function participantPool(institutionId?: string | null) {
  const list = await User.find({ role: "participant", deletedAt: { $exists: false }, ...(institutionId ? { institutionId } : {}) }).select("name givenName surname email").lean();
  return list.map((u) => ({ id: String(u._id), name: u.name || [u.givenName, u.surname].filter(Boolean).join(" ") || u.email, email: u.email }));
}

/**
 * Konfirmasi hasil PURE/OCE untuk satu peserta: level dari padanan ITP, kuota coaching periode berjalan,
 * lalu masuk kelas yang masih ada kursinya. Dianggap sebagai placement periode ini (placement di aplikasi tidak diwajibkan lagi).
 */
export async function applyExternalResult(r: ExternalResultDoc & { save?: () => Promise<unknown> }, userId: string, adminId: Types.ObjectId) {
  await connectDB();
  if (r.itpScore == null) throw new HttpError(400, "Enter the score first");
  const user = await User.findOne({ _id: userId, role: "participant" });
  if (!user) throw new HttpError(404, "Participant not found");
  const level = levelForScore(await getLevels(), r.itpScore);
  if (!level) throw new HttpError(400, "The score does not fall in any level range");
  const cs = await cycleState(user.institutionId);
  const cycleId = cs.active?._id;
  const changed = !user.currentLevelId || String(user.currentLevelId) !== String(level._id);

  user.currentLevelId = level._id;
  user.currentScoreEst = r.itpScore;
  user.placementAttemptId = r._id; // penanda placement sudah ada (sumbernya hasil luar, bukan attempt)
  user.set("placementSource", r.source);
  user.placementCycleId = cycleId;
  user.placementRetakeAllowed = false;
  if (changed) user.levelHistory.push({ levelId: level._id, at: new Date(), reason: r.source } as never);
  await user.save();

  const quota = await CoachingQuota.findOne({ userId: user._id, active: true });
  const newCycle = !!cycleId && String(quota?.programCycleId ?? "") !== String(cycleId);
  if (user.institutionId && (!quota || changed || newCycle)) {
    if (quota) await CoachingQuota.updateMany({ userId: user._id, active: true }, { active: false });
    await CoachingQuota.create({ userId: user._id, institutionId: user.institutionId, levelId: level._id, total: level.coachingQuota, ...(cycleId ? { programCycleId: cycleId } : {}) });
  }
  await ExternalResult.updateOne({ _id: r._id }, { userId: user._id, status: "confirmed", confirmedBy: adminId, confirmedAt: new Date(), ...(cycleId ? { programCycleId: cycleId } : {}) });
  const classId = await assignClass(String(user._id), adminId, "auto");
  await notify(user._id, "placement_result", { title: `Your ${r.source.toUpperCase()} result is in: ${level.name} level`, body: `EPTA equivalent ${r.itpScore}. Coaching quota ${level.coachingQuota} sessions.`, href: "/home" }, `ext-${r._id}`);
  await audit(adminId, "external_result.confirm", String(r._id), { userId: String(user._id), level: level.key, itp: r.itpScore, classId });
  return { level: level.name, classId };
}

/** Kelas yang cocok untuk peserta: level sama, institusi sama atau umum, periode aktif atau tanpa periode. */
async function eligibleClasses(user: { currentLevelId?: Types.ObjectId | null; institutionId?: Types.ObjectId | null }) {
  if (!user.currentLevelId) return [];
  const cs = await cycleState(user.institutionId);
  return ClassGroup.find({
    active: true, levelId: user.currentLevelId,
    $and: [
      { $or: [{ institutionId: { $exists: false } }, { institutionId: null }, ...(user.institutionId ? [{ institutionId: user.institutionId }] : [])] },
      { $or: [{ programCycleId: { $exists: false } }, { programCycleId: null }, ...(cs.active ? [{ programCycleId: cs.active._id }] : [])] },
    ],
  }).lean();
}

export async function memberCounts(classIds: Types.ObjectId[]) {
  const rows = await ClassMember.aggregate([{ $match: { classId: { $in: classIds }, active: true } }, { $group: { _id: "$classId", n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}

/** Masukkan peserta ke kelas. `auto`: kelas berkursi yang paling longgar (acak bila seri); null = menunggu kelas. */
export async function assignClass(userId: string, adminId: Types.ObjectId | undefined, method: "auto" | "manual", classId?: string | null) {
  const user = await User.findById(userId).select("currentLevelId institutionId").lean();
  if (!user) throw new HttpError(404, "Participant not found");
  const current = await ClassMember.findOne({ userId, active: true }).lean();
  let target: string | null = null;
  if (method === "manual") {
    if (classId) {
      const c = await ClassGroup.findById(classId).lean();
      if (!c || !c.active) throw new HttpError(404, "Class not found");
      const n = (await memberCounts([c._id])).get(String(c._id)) ?? 0;
      if (n >= c.capacity && String(current?.classId ?? "") !== String(c._id)) throw new HttpError(409, `${c.name} is full (${c.capacity} seats)`);
      target = String(c._id);
    }
  } else {
    const classes = await eligibleClasses(user);
    // Peserta yang sudah di kelas yang masih cocok tidak dipindah.
    if (current && classes.some((c) => String(c._id) === String(current.classId))) return String(current.classId);
    const counts = await memberCounts(classes.map((c) => c._id));
    target = pickClass(classes.map((c) => ({ id: String(c._id), capacity: c.capacity, count: counts.get(String(c._id)) ?? 0 })));
  }
  if (String(current?.classId ?? "") === String(target ?? "")) return target;
  if (current) await ClassMember.updateOne({ _id: current._id }, { active: false, leftAt: new Date() });
  if (target) await ClassMember.create({ classId: target, userId, method, assignedBy: adminId });
  if (adminId) await audit(adminId, method === "manual" ? "class.move" : "class.assign", userId, { from: current ? String(current.classId) : null, to: target });
  return target;
}

/** Statistik kelas: jumlah siswa, aktif 7 hari terakhir (login atau belajar), rata-rata skor. */
export async function classStats(classIds: Types.ObjectId[]) {
  const members = await ClassMember.find({ classId: { $in: classIds }, active: true }).select("classId userId").lean();
  const ids = members.map((m) => m.userId);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const day = since.toISOString().slice(0, 10);
  const [users, learners] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("lastLoginAt currentScoreEst status").lean(),
    LearningEvent.distinct("userId", { userId: { $in: ids }, day: { $gte: day } }),
  ]);
  const learned = new Set(learners.map(String));
  const byUser = new Map(users.map((u) => [String(u._id), u]));
  const out = new Map<string, { students: number; active: number; avgScore: number | null }>();
  for (const id of classIds) {
    const ms = members.filter((m) => String(m.classId) === String(id)).map((m) => byUser.get(String(m.userId))).filter(Boolean) as typeof users;
    const active = ms.filter((u) => (u.lastLoginAt && u.lastLoginAt >= since) || learned.has(String(u._id))).length;
    const scores = ms.map((u) => u.currentScoreEst).filter((s): s is number => typeof s === "number");
    out.set(String(id), { students: ms.length, active, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null });
  }
  return out;
}

export const isActiveSince = (lastLoginAt: Date | null | undefined, learned: boolean, since: Date) => learned || (!!lastLoginAt && lastLoginAt >= since);

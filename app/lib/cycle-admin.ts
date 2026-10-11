import { HttpError } from "./rbac";
import { overlaps } from "./cycles";
import { ProgramCycle } from "@/models/Cycle";
import { User } from "@/models/User";
import { Enrollment } from "@/models/Access";
import { CoachingQuota } from "@/models/Config";

/** Tolak periode yang beririsan dengan periode lain milik institusi yang sama. */
export async function assertNoOverlap(institutionId: string, c: { startsAt: Date; endsAt: Date; closedAt?: Date | null }, exceptId?: string) {
  const others = await ProgramCycle.find({ institutionId, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).lean();
  const hit = others.find((o) => overlaps(c, o));
  if (hit) throw new HttpError(409, `The dates overlap with "${hit.name}". Program periods of one institution cannot overlap.`);
}

/**
 * Periode pertama institusi yang langsung aktif: peserta yang sudah ber-placement dan berkuota dianggap sudah memenuhi periode ini
 * (tanpa mengulang diagnostik). Periode berikutnya selalu mewajibkan placement baru.
 */
export async function adoptExisting(institutionId: string, cycleId: string) {
  const ids = (await Enrollment.find({ institutionId, status: "active" }).select("userId").lean()).map((e) => e.userId);
  const r = await User.updateMany({ _id: { $in: ids }, placementAttemptId: { $exists: true } }, { placementCycleId: cycleId });
  await CoachingQuota.updateMany({ institutionId, active: true, programCycleId: { $exists: false } }, { programCycleId: cycleId });
  return r.modifiedCount;
}

import type { Types } from "mongoose";
import { connectDB } from "./db";
import { ProgramCycle } from "@/models/Cycle";

export type CycleStatus = "scheduled" | "active" | "closed";
type CycleLite = { _id: Types.ObjectId; startsAt: Date; endsAt: Date; closedAt?: Date | null };

/** Status periode: ditutup manual atau lewat tanggal berakhir = closed; belum mulai = scheduled. */
export function cycleStatus(c: Pick<CycleLite, "startsAt" | "endsAt" | "closedAt">, now = new Date()): CycleStatus {
  if (c.closedAt || now > c.endsAt) return "closed";
  if (now < c.startsAt) return "scheduled";
  return "active";
}

/** Dua periode institusi yang sama tidak boleh beririsan (periode yang sudah ditutup manual dihitung sampai saat penutupan). */
export function overlaps(a: { startsAt: Date; endsAt: Date; closedAt?: Date | null }, b: { startsAt: Date; endsAt: Date; closedAt?: Date | null }) {
  const end = (x: typeof a) => (x.closedAt && x.closedAt < x.endsAt ? x.closedAt : x.endsAt);
  return a.startsAt < end(b) && b.startsAt < end(a);
}

export type CycleState = { hasCycles: boolean; active: CycleLite | null; blockedReason: string | null };

/** Keadaan periode untuk institusi. Institusi tanpa periode memakai perilaku lama (tanpa batas periode). */
export async function cycleState(institutionId: Types.ObjectId | string | null | undefined, now = new Date()): Promise<CycleState> {
  if (!institutionId) return { hasCycles: false, active: null, blockedReason: null };
  await connectDB();
  const all = await ProgramCycle.find({ institutionId }).lean();
  if (!all.length) return { hasCycles: false, active: null, blockedReason: null };
  const active = all.find((c) => cycleStatus(c, now) === "active") ?? null;
  if (active) return { hasCycles: true, active, blockedReason: null };
  const upcoming = all.some((c) => cycleStatus(c, now) === "scheduled");
  return {
    hasCycles: true, active: null,
    blockedReason: upcoming
      ? "Your next program period has not started yet. Graded activities open when it starts."
      : "Your program period has ended. Course materials stay readable, but tests, quizzes, and new coaching bookings are closed.",
  };
}

/** Wajib diagnostik (placement) bila belum pernah, atau periode aktif sekarang belum punya placement-nya. */
export function placementNeeded(user: { placementAttemptId?: Types.ObjectId | null; placementCycleId?: Types.ObjectId | null }, state: CycleState) {
  if (!user.placementAttemptId) return true;
  if (state.active && String(user.placementCycleId ?? "") !== String(state.active._id)) return true;
  return false;
}

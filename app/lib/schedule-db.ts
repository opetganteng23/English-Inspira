import type { Types } from "mongoose";
import { connectDB } from "./db";
import { effectiveWindow, type Window } from "./schedule";
import { TestSeat, TestSession } from "@/models/Schedule";

export type SeatInfo = { window: Window; label: string; sessionId: string };

/** Kursi peserta per tes (hanya tes yang diminta). Jendela sudah memperhitungkan perpanjangan per peserta. */
export async function seatsFor(userId: Types.ObjectId | string, testIds: (Types.ObjectId | string)[]): Promise<Map<string, SeatInfo>> {
  await connectDB();
  const out = new Map<string, SeatInfo>();
  if (!testIds.length) return out;
  const seats = await TestSeat.find({ userId, testId: { $in: testIds } }).lean();
  if (!seats.length) return out;
  const sessions = await TestSession.find({ _id: { $in: seats.map((s) => s.sessionId) } }).lean();
  const byId = new Map(sessions.map((s) => [String(s._id), s]));
  for (const seat of seats) {
    const s = byId.get(String(seat.sessionId));
    if (s) out.set(String(seat.testId), { window: effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, seat.override), label: s.label, sessionId: String(s._id) });
  }
  return out;
}

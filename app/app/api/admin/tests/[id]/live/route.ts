import { NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Attempt } from "@/models/Test";
import { TestSeat, TestSession } from "@/models/Schedule";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
const OFFLINE_MS = 90_000; // sama dengan batas terputus ruang tes (heartbeat 30 detik)

type P = { userId: string; name: string | null; email: string; phone: string | null; attemptId: string | null; lastSeen: Date | null };

/** Hari tes: per sesi, siapa belum masuk, sedang mengerjakan, terputus, dan selesai. Kehadiran dari kursi + attempt tes ini. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const testId = new Types.ObjectId(params.id);
    const [sessions, seats] = await Promise.all([
      TestSession.find({ testId }).sort({ opensAt: 1 }).lean(),
      TestSeat.find({ testId }).select("sessionId userId override").lean(),
    ]);
    const userIds = seats.map((s) => s.userId);
    const [users, attempts] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("name email phone").lean(),
      Attempt.find({ testId, userId: { $in: userIds } }).sort({ startedAt: 1 }).select("userId status conn.lastSeenAt").lean(),
    ]);
    const u = new Map(users.map((x) => [String(x._id), x]));
    const att = new Map(attempts.map((a) => [String(a.userId), a])); // attempt terakhir per peserta
    const now = Date.now();
    const out = sessions.map((s) => {
      const groups = { notStarted: [] as P[], running: [] as P[], offline: [] as P[], done: [] as P[] };
      for (const seat of seats.filter((x) => String(x.sessionId) === String(s._id))) {
        const usr = u.get(String(seat.userId)); const a = att.get(String(seat.userId));
        const p: P = { userId: String(seat.userId), name: usr?.name ?? null, email: usr?.email ?? "", phone: usr?.phone ?? null, attemptId: a ? String(a._id) : null, lastSeen: a?.conn?.lastSeenAt ?? null };
        if (!a) groups.notStarted.push(p);
        else if (a.status === "submitted") groups.done.push(p);
        else if (a.conn?.lastSeenAt && now - +new Date(a.conn.lastSeenAt) > OFFLINE_MS) groups.offline.push(p);
        else groups.running.push(p);
      }
      const state = now < +s.opensAt ? "upcoming" : now > +s.closesAt ? "closed" : "open";
      return { id: String(s._id), label: s.label, opensAt: s.opensAt, closesAt: s.closesAt, capacity: s.capacity, state, ...groups };
    });
    return NextResponse.json({ sessions: out, at: new Date() });
  } catch (e) {
    return handleError(e);
  }
}

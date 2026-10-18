import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext, memberIds } from "@/lib/inst";
import { effectiveWindow } from "@/lib/schedule";
import { Test, Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { TestSeat, TestSession } from "@/models/Schedule";

export const dynamic = "force-dynamic";

/** Papan jadwal versi portal institusi: bentuk sama dengan papan admin, hanya peserta institusi ini, tanpa skor dan tanpa aksi. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { inst, scoped } = await instContext(req);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const ids = await memberIds(scoped());
    const seats = await TestSeat.find({ testId: params.id, userId: { $in: ids } }).lean();
    if (!seats.length) throw new HttpError(404, "Test not found");
    const [test, sessions, attempts, users] = await Promise.all([
      Test.findById(params.id).select("name scheduled reminderMode").lean(),
      TestSession.find({ testId: params.id }).sort({ opensAt: 1 }).lean(),
      Attempt.find({ testId: params.id, userId: { $in: seats.map((s) => s.userId) } }).select("userId status").lean(),
      User.find({ _id: { $in: seats.map((s) => s.userId) } }).select("name email").lean(),
    ]);
    if (!test) throw new HttpError(404, "Test not found");
    const uBy = new Map(users.map((u) => [String(u._id), u]));
    const att = new Map<string, string>();
    for (const a of attempts) { const k = String(a.userId); if (att.get(k) !== "done") att.set(k, a.status === "submitted" ? "done" : "running"); }
    return NextResponse.json({
      test: { id: params.id, name: test.name, scheduled: !!test.scheduled, reminderMode: test.reminderMode ?? "all" },
      institutions: [{ id: String(inst._id), name: inst.name }],
      pending: { invite: 0, reschedule: 0, skipped: 0 },
      sessions: sessions.map((s) => ({
        id: String(s._id), label: s.label, opensAt: s.opensAt, closesAt: s.closesAt, capacity: s.capacity, pending: 0,
        seats: seats.filter((x) => String(x.sessionId) === String(s._id)).map((x) => {
          const u = uBy.get(String(x.userId)); const w = effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, x.override);
          return { userId: String(x.userId), name: u?.name ?? null, email: u?.email ?? "", institution: inst.name, invited: !!x.invitedAt, extended: !!x.override?.at, opensAt: w.opensAt, closesAt: w.closesAt, status: att.get(String(x.userId)) ?? null };
        }).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email)),
      })),
      pool: [],
    });
  } catch (e) {
    return handleError(e);
  }
}

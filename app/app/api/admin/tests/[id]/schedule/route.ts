import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { effectiveWindow } from "@/lib/schedule";
import { eligiblePool, pendingInvites } from "@/lib/schedule-admin";
import { Test, Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { TestSeat, TestSession } from "@/models/Schedule";
import { AuditLog } from "@/models/AuditLog";

export const dynamic = "force-dynamic";

/** Papan jadwal: sesi (kartu), peserta di tiap sesi, dan kolom "belum dapat slot". */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const test = await Test.findById(params.id).select("name scheduled kind").lean();
    if (!test) throw new HttpError(404, "Test not found");
    const [sessions, seats, pool, pending, attempts, insts] = await Promise.all([
      TestSession.find({ testId: params.id }).sort({ opensAt: 1 }).lean(),
      TestSeat.find({ testId: params.id }).lean(),
      eligiblePool(params.id),
      pendingInvites(params.id),
      Attempt.find({ testId: params.id }).select("userId status").lean(),
      Institution.find().select("name").lean(),
    ]);
    const users = new Map((await User.find({ _id: { $in: seats.map((s) => s.userId) } }).select("name email institutionId").lean()).map((u) => [String(u._id), u]));
    const inst = new Map(insts.map((i) => [String(i._id), i.name]));
    const att = new Map<string, string>();
    for (const a of attempts) { const k = String(a.userId); if (att.get(k) !== "done") att.set(k, a.status === "submitted" ? "done" : "running"); }
    return NextResponse.json({
      test: { id: params.id, name: test.name, scheduled: !!test.scheduled },
      institutions: insts.map((i) => ({ id: String(i._id), name: i.name })),
      pending,
      sessions: sessions.map((s) => ({
        id: String(s._id), label: s.label, opensAt: s.opensAt, closesAt: s.closesAt, capacity: s.capacity,
        seats: seats.filter((x) => String(x.sessionId) === String(s._id)).map((x) => {
          const u = users.get(String(x.userId)); const w = effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, x.override);
          return { userId: String(x.userId), name: u?.name ?? null, email: u?.email ?? "", institution: u?.institutionId ? inst.get(String(u.institutionId)) ?? null : null, invited: !!x.invitedAt, extended: !!x.override?.at, opensAt: w.opensAt, closesAt: w.closesAt, status: att.get(String(x.userId)) ?? null };
        }),
      })),
      pool,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const p = z.object({ scheduled: z.boolean() }).safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    await connectDB();
    const t = await Test.findByIdAndUpdate(params.id, { scheduled: p.data.scheduled }, { returnDocument: "after" });
    if (!t) throw new HttpError(404, "Test not found");
    await AuditLog.create({ actorId: admin._id, action: "test.schedule_toggle", target: params.id, meta: { scheduled: p.data.scheduled } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

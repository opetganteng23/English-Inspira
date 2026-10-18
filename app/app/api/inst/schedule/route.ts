import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext, memberIds } from "@/lib/inst";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import { Test, Attempt } from "@/models/Test";
import { TestSession, TestSeat } from "@/models/Schedule";
import { User } from "@/models/User";
import { effectiveWindow } from "@/lib/schedule";
import { rowStatus } from "@/lib/test-export";

export const dynamic = "force-dynamic";

/**
 * Jadwal tes rombongan institusi:
 * 1) Tes terjadwal di aplikasi (mis. Placement per tanggal): peserta per sesi dan status pengerjaan, TANPA skor.
 * 2) Tes EPTA resmi: peserta yang terdaftar per sesi. Tanpa NIK/dokumen.
 */
export async function GET(req: Request) {
  try {
    const { scoped } = await instContext(req);
    const ids = await memberIds(scoped());
    const now = new Date();

    const seats = await TestSeat.find({ userId: { $in: ids } }).select("testId sessionId userId override").lean();
    const [sessions, tests, users, attempts] = await Promise.all([
      TestSession.find({ _id: { $in: [...new Set(seats.map((s) => String(s.sessionId)))] } }).sort({ opensAt: 1 }).lean(),
      Test.find({ _id: { $in: [...new Set(seats.map((s) => String(s.testId)))] } }).select("name kind").lean(),
      User.find({ _id: { $in: [...new Set(seats.map((s) => String(s.userId)))] } }).select("name email").lean(),
      Attempt.find({ userId: { $in: seats.map((s) => s.userId) }, testId: { $in: [...new Set(seats.map((s) => s.testId))] } }).select("userId testId status").sort({ startedAt: 1 }).lean(),
    ]);
    const uBy = new Map(users.map((u) => [String(u._id), u]));
    const aBy = new Map<string, { status: string }>();
    for (const a of attempts) { const k = `${a.testId}:${a.userId}`; const cur = aBy.get(k); if (!cur || a.status === "submitted" || cur.status !== "submitted") aBy.set(k, a); }
    const groups = tests.map((t) => ({
      id: String(t._id), name: t.name, kind: t.kind,
      sessions: sessions.filter((s) => String(s.testId) === String(t._id)).map((s) => {
        const people = seats.filter((x) => String(x.sessionId) === String(s._id)).map((x) => {
          const u = uBy.get(String(x.userId));
          const win = effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, x.override);
          return { name: u?.name ?? u?.email ?? "-", email: u?.email ?? "", status: rowStatus(aBy.get(`${t._id}:${x.userId}`) ?? null, win, now), special: !!x.override?.at };
        }).sort((a, b) => a.name.localeCompare(b.name));
        return { id: String(s._id), label: s.label, opensAt: s.opensAt, closesAt: s.closesAt, people };
      }),
    }));

    const regs = await ItpRegistration.find({ userId: { $in: ids }, status: { $ne: "cancelled" } }).select("fullName sessionId status docStatus score").lean();
    const itp = await ItpSession.find({ _id: { $in: Array.from(new Set(regs.map((r) => String(r.sessionId)))) } }).sort({ date: 1 }).lean();
    return NextResponse.json({
      groups,
      sessions: itp.map((s) => ({
        id: String(s._id), title: s.title, date: s.date, place: s.place,
        participants: regs.filter((r) => String(r.sessionId) === String(s._id)).map((r) => ({ name: r.fullName, status: r.status, docStatus: r.docStatus, total: r.score?.total ?? null })),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

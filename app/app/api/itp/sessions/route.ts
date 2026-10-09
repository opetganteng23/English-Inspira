import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { getSetting } from "@/models/Settings";
import { Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { ItpSession, ItpRegistration } from "@/models/Itp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const [sessions, regs, last, u, cfg] = await Promise.all([
      ItpSession.find({ status: "open", date: { $gt: new Date() } }).sort({ date: 1 }).lean(),
      ItpRegistration.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Attempt.findOne({ userId: user._id, status: "submitted" }).sort({ finishedAt: -1 }).select("scoreEst kind finishedAt").lean(),
      User.findById(user._id).select("targetScore name").lean(),
      getSetting("general", { itpOrganizer: "", rescheduleDays: 7, refundPolicy: "" }),
    ]);

    // Saran jadwal: minimal sesuai selisih skor (perkiraan ~15 poin per minggu latihan), bukan jaminan.
    let advice: { weeks: number; minDate: string; basis: string } | null = null;
    if (last?.scoreEst && u?.targetScore) {
      const gap = Math.max(0, u.targetScore - last.scoreEst);
      const weeks = gap === 0 ? 1 : Math.max(2, Math.ceil(gap / 15));
      advice = { weeks, minDate: new Date(Date.now() + weeks * 7 * 86_400_000).toISOString(), basis: `Last simulation score ${last.scoreEst}, target ${u.targetScore}` };
    }
    const regSessions = new Map((await ItpSession.find({ _id: { $in: regs.map((r) => r.sessionId) } }).lean()).map((s) => [String(s._id), s]));
    return NextResponse.json({
      // Tes ITP resmi tidak berbayar di platform ini: peserta ber-enrollment boleh mendaftar, satu pendaftaran aktif sekaligus.
      itpRemaining: regs.some((r) => ["submitted", "confirmed"].includes(r.status)) ? 0 : 1,
      organizer: cfg.itpOrganizer, rescheduleDays: cfg.rescheduleDays, advice,
      sessions: sessions.map((s) => ({ id: String(s._id), title: s.title, date: s.date, place: s.place, organizer: s.organizer ?? cfg.itpOrganizer, quota: s.quota, left: Math.max(0, s.quota - s.registered), tooSoon: advice ? +s.date < +new Date(advice.minDate) : false })),
      registrations: regs.map((r) => {
        const s = regSessions.get(String(r.sessionId));
        return {
          id: String(r._id), status: r.status, docStatus: r.docStatus, docNote: r.docNote ?? null, fullName: r.fullName, nikLast4: r.nikLast4,
          session: s ? { id: String(s._id), title: s.title, date: s.date, place: s.place } : null, score: r.score ?? null, certificateId: r.certificateId ? String(r.certificateId) : null,
          canCancel: !!s && ["submitted", "confirmed"].includes(r.status) && +s.date - cfg.rescheduleDays * 86_400_000 > Date.now(),
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

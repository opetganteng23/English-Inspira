import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext, memberIds } from "@/lib/inst";
import { ItpRegistration, ItpSession } from "@/models/Itp";

export const dynamic = "force-dynamic";

/** Jadwal tes rombongan: peserta institusi yang terdaftar tes ITP resmi, dikelompokkan per sesi. Tanpa NIK/dokumen. */
export async function GET(req: Request) {
  try {
    const { scoped } = await instContext(req);
    const ids = await memberIds(scoped());
    const regs = await ItpRegistration.find({ userId: { $in: ids }, status: { $ne: "cancelled" } }).select("fullName sessionId status docStatus score").lean();
    const sessions = await ItpSession.find({ _id: { $in: Array.from(new Set(regs.map((r) => String(r.sessionId)))) } }).sort({ date: 1 }).lean();
    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: String(s._id), title: s.title, date: s.date, place: s.place,
        participants: regs.filter((r) => String(r.sessionId) === String(s._id)).map((r) => ({ name: r.fullName, status: r.status, docStatus: r.docStatus, total: r.score?.total ?? null })),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

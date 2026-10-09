import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sessionInput } from "@/lib/admin-schemas";
import { ItpSession, ItpRegistration } from "@/models/Itp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sessions = await ItpSession.find().sort({ date: -1 }).lean();
    const stats = await ItpRegistration.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$sessionId", total: { $sum: 1 }, docsValid: { $sum: { $cond: [{ $eq: ["$docStatus", "valid"] }, 1, 0] } }, docsPending: { $sum: { $cond: [{ $eq: ["$docStatus", "pending"] }, 1, 0] } }, scored: { $sum: { $cond: [{ $ifNull: ["$score.total", false] }, 1, 0] } } } },
    ]);
    const by = new Map(stats.map((s) => [String(s._id), s]));
    return NextResponse.json({
      sessions: sessions.map((s) => {
        const st = by.get(String(s._id));
        return { id: String(s._id), title: s.title, date: s.date, place: s.place, organizer: s.organizer, quota: s.quota, registered: s.registered, status: s.status, docsValid: st?.docsValid ?? 0, docsPending: st?.docsPending ?? 0, scored: st?.scored ?? 0, total: st?.total ?? 0 };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = sessionInput.parse(await req.json());
    await connectDB();
    const s = await ItpSession.create(b);
    await audit(admin._id, "itp.session.create", String(s._id));
    return NextResponse.json({ id: String(s._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

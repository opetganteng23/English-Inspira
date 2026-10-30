import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { CATEGORY, staffReply } from "@/lib/support";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Attempt, Test } from "@/models/Test";
import { TestSeat, TestSession } from "@/models/Schedule";

export const dynamic = "force-dynamic";

/** Konteks di samping percakapan (8.5): profil, jadwal sesi, tes terakhir dan status koneksinya. Tindakan dijalankan admin dari profil peserta. */
async function context(userId: unknown, email: string) {
  const u = await User.findOne(userId ? { _id: userId } : { email }).select("name email role phone status institutionId currentLevelId").lean();
  if (!u) return null;
  const [inst, seats, attempts] = await Promise.all([
    u.institutionId ? Institution.findById(u.institutionId).select("name").lean() : null,
    TestSeat.find({ userId: u._id }).select("testId sessionId override").lean(),
    Attempt.find({ userId: u._id }).sort({ startedAt: -1 }).limit(3).select("testId status startedAt finishedAt scoreEst conn.lastSeenAt").lean(),
  ]);
  const sessions = new Map((await TestSession.find({ _id: { $in: seats.map((s) => s.sessionId) } }).select("label opensAt closesAt").lean()).map((s) => [String(s._id), s]));
  const tests = new Map((await Test.find({ _id: { $in: [...seats.map((s) => s.testId), ...attempts.map((a) => a.testId)] } }).select("name").lean()).map((t) => [String(t._id), t.name]));
  return {
    id: String(u._id), name: u.name ?? null, email: u.email, role: u.role, phone: u.phone ?? null, status: u.status, institution: inst?.name ?? null, placed: !!u.currentLevelId,
    seats: seats.map((s) => { const ses = sessions.get(String(s.sessionId)); return { test: tests.get(String(s.testId)) ?? "Test", session: ses?.label ?? "-", opensAt: s.override?.opensAt ?? ses?.opensAt ?? null, closesAt: s.override?.closesAt ?? ses?.closesAt ?? null, extended: !!s.override?.at }; }),
    attempts: attempts.map((a) => ({ id: String(a._id), test: tests.get(String(a.testId)) ?? "Test", status: a.status, startedAt: a.startedAt, finishedAt: a.finishedAt ?? null, lastSeen: a.conn?.lastSeenAt ?? null })),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Ticket not found");
    await connectDB();
    const t = await Ticket.findById(params.id).lean();
    if (!t) throw new HttpError(404, "Ticket not found");
    return NextResponse.json({
      id: String(t._id), number: t.number, name: t.name, email: t.email, category: CATEGORY[t.category]?.label ?? t.category, team: t.team, status: t.status, urgent: !!t.urgent,
      page: t.page ?? null, userAgent: t.userAgent ?? null, createdAt: t.createdAt, signedIn: !!t.userId,
      messages: t.messages.map((m) => ({ from: m.from, byName: m.byName ?? null, body: m.body, at: m.at })),
      context: await context(t.userId, t.email),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({
  reply: z.string().trim().min(1).max(4000).optional(),
  note: z.string().trim().min(1).max(2000).optional(), // catatan internal, tidak terlihat pengirim
  status: z.enum(["new", "in_progress", "waiting", "resolved"]).optional(),
  team: z.enum(["cs", "tech"]).optional(),
  urgent: z.boolean().optional(),
});

/** Balas, catatan internal, ubah status, pindah tim, tandai urgent. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Ticket not found");
    const b = patch.parse(await req.json());
    await connectDB();
    if (b.reply && !(await staffReply(params.id, admin, b.reply))) throw new HttpError(404, "Ticket not found");
    const t = await Ticket.findById(params.id);
    if (!t) throw new HttpError(404, "Ticket not found");
    const who = admin.name || admin.email;
    if (b.note) t.messages.push({ from: "system", by: admin._id, byName: who, body: `Internal note: ${b.note}`, at: new Date() });
    if (b.team && b.team !== t.team) { t.messages.push({ from: "system", by: admin._id, byName: who, body: `Moved to ${b.team === "tech" ? "Technical" : "CS"} by ${who}`, at: new Date() }); t.team = b.team; }
    if (b.status && b.status !== t.status) { t.status = b.status; t.resolvedAt = b.status === "resolved" ? new Date() : undefined; }
    if (b.urgent !== undefined) t.urgent = b.urgent;
    await t.save();
    await audit(admin._id, "support.update", params.id, { reply: !!b.reply, status: b.status ?? null, team: b.team ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return handleError(e);
  }
}

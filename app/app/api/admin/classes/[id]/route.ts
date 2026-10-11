import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { classInput } from "@/lib/class-schemas";
import { memberCounts } from "@/lib/clustering";
import { ClassGroup, ClassMember } from "@/models/Cluster";
import { User } from "@/models/User";
import { LearningEvent } from "@/models/Course";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Class not found");
  await connectDB();
  const c = await ClassGroup.findById(id);
  if (!c) throw new HttpError(404, "Class not found");
  return c;
}

/** Daftar siswa kelas dengan status aktif (login atau belajar 7 hari terakhir). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const c = await find(params.id);
    const ms = await ClassMember.find({ classId: c._id, active: true }).sort({ createdAt: 1 }).lean();
    const ids = ms.map((m) => m.userId);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [users, learners] = await Promise.all([
      User.find({ _id: { $in: ids } }).select("name email currentScoreEst lastLoginAt placementSource status").lean(),
      LearningEvent.distinct("userId", { userId: { $in: ids }, day: { $gte: since.toISOString().slice(0, 10) } }),
    ]);
    const learned = new Set(learners.map(String));
    const by = new Map(users.map((u) => [String(u._id), u]));
    return NextResponse.json({
      class: { id: String(c._id), name: c.name, capacity: c.capacity },
      members: ms.map((m) => {
        const u = by.get(String(m.userId));
        return { userId: String(m.userId), name: u?.name ?? u?.email ?? "-", email: u?.email ?? "", score: u?.currentScoreEst ?? null, source: u?.placementSource ?? null, method: m.method, joinedAt: m.createdAt, lastLoginAt: u?.lastLoginAt ?? null, active: !!u && ((!!u.lastLoginAt && u.lastLoginAt >= since) || learned.has(String(u._id))) };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const c = await find(params.id);
    const b = classInput.parse(await req.json());
    const n = (await memberCounts([c._id])).get(String(c._id)) ?? 0;
    if (b.capacity < n) throw new HttpError(409, `Capacity cannot be below the current ${n} students. Move some students first.`);
    if (String(b.levelId) !== String(c.levelId) && n > 0) throw new HttpError(409, "Move the students out before changing the level of this class");
    if (b.coachId && !(await User.exists({ _id: b.coachId, role: "coach" }))) throw new HttpError(400, "Coach not found");
    c.set({ ...b, institutionId: b.institutionId ?? undefined, programCycleId: b.programCycleId ?? undefined, coachId: b.coachId ?? undefined });
    await c.save();
    await audit(admin._id, "class.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const c = await find(params.id);
    if (await ClassMember.exists({ classId: c._id, active: true })) throw new HttpError(409, "This class still has students. Move them first, or deactivate the class.");
    if (await ClassMember.exists({ classId: c._id })) { c.active = false; await c.save(); await audit(admin._id, "class.deactivate", params.id); return NextResponse.json({ ok: true, deactivated: true }); }
    await c.deleteOne();
    await audit(admin._id, "class.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

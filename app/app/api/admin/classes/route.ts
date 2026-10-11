import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { classInput } from "@/lib/class-schemas";
import { audit } from "@/lib/audit";
import { getLevels } from "@/lib/config";
import { classStats } from "@/lib/clustering";
import { cycleStatus } from "@/lib/cycles";
import { ClassGroup, ClassMember } from "@/models/Cluster";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { ProgramCycle } from "@/models/Cycle";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const [levels, classes, insts, cycles, coaches] = await Promise.all([
      getLevels(), ClassGroup.find().sort({ name: 1 }).lean(), Institution.find().select("name").sort({ name: 1 }).lean(),
      ProgramCycle.find().select("name institutionId startsAt endsAt closedAt").sort({ startsAt: -1 }).lean(),
      User.find({ role: "coach", status: { $ne: "disabled" }, deletedAt: { $exists: false } }).select("name email institutionId").lean(),
    ]);
    const stats = await classStats(classes.map((c) => c._id));
    // Menunggu kelas: sudah punya level tetapi belum ada di kelas aktif mana pun.
    const placed = await ClassMember.distinct("userId", { active: true });
    const waiting = await User.aggregate([
      { $match: { role: "participant", status: "active", deletedAt: { $exists: false }, currentLevelId: { $exists: true, $ne: null }, _id: { $nin: placed } } },
      { $group: { _id: "$currentLevelId", n: { $sum: 1 } } },
    ]);
    const waitBy = new Map(waiting.map((w) => [String(w._id), w.n as number]));
    const instName = new Map(insts.map((i) => [String(i._id), i.name]));
    const coachName = new Map(coaches.map((c) => [String(c._id), c.name ?? c.email]));
    return NextResponse.json({
      levels: levels.map((l) => ({ id: String(l._id), name: l.name, scoreMin: l.scoreMin, scoreMax: l.scoreMax, waiting: waitBy.get(String(l._id)) ?? 0 })),
      institutions: insts.map((i) => ({ id: String(i._id), name: i.name })),
      cycles: cycles.map((c) => ({ id: String(c._id), name: c.name, institution: instName.get(String(c.institutionId)) ?? "-", status: cycleStatus(c) })),
      coaches: coaches.map((c) => ({ id: String(c._id), name: c.name ?? c.email, institutionId: c.institutionId ? String(c.institutionId) : null })),
      classes: classes.map((c) => {
        const s = stats.get(String(c._id)) ?? { students: 0, active: 0, avgScore: null };
        return {
          id: String(c._id), name: c.name, levelId: String(c.levelId), capacity: c.capacity, isActive: c.active,
          institutionId: c.institutionId ? String(c.institutionId) : null, institution: c.institutionId ? instName.get(String(c.institutionId)) ?? null : null,
          programCycleId: c.programCycleId ? String(c.programCycleId) : null, cycle: c.programCycleId ? cycles.find((x) => String(x._id) === String(c.programCycleId))?.name ?? null : null,
          coachId: c.coachId ? String(c.coachId) : null, coach: c.coachId ? coachName.get(String(c.coachId)) ?? null : null, ...s,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = classInput.parse(await req.json());
    await connectDB();
    if (b.coachId && !(await User.exists({ _id: b.coachId, role: "coach" }))) throw new HttpError(400, "Coach not found");
    const c = await ClassGroup.create({ ...b, institutionId: b.institutionId ?? undefined, programCycleId: b.programCycleId ?? undefined, coachId: b.coachId ?? undefined });
    await audit(admin._id, "class.create", String(c._id), { name: b.name });
    return NextResponse.json({ id: String(c._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

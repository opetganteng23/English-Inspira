import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { cycleInput } from "@/lib/cycle-schemas";
import { cycleStatus } from "@/lib/cycles";
import { assertNoOverlap, adoptExisting } from "@/lib/cycle-admin";
import { ProgramCycle } from "@/models/Cycle";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { Booking } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [cycles, insts] = await Promise.all([ProgramCycle.find().sort({ startsAt: -1 }).lean(), Institution.find().select("name").sort({ name: 1 }).lean()]);
    const name = new Map(insts.map((i) => [String(i._id), i.name]));
    const rows = await Promise.all(cycles.map(async (c) => {
      const [placed, quotas, attempts, bookings] = await Promise.all([
        User.countDocuments({ placementCycleId: c._id }), CoachingQuota.countDocuments({ programCycleId: c._id }),
        Attempt.countDocuments({ programCycleId: c._id }), Booking.countDocuments({ programCycleId: c._id }),
      ]);
      return {
        id: String(c._id), institutionId: String(c.institutionId), institution: name.get(String(c.institutionId)) ?? "-", name: c.name,
        startsAt: c.startsAt, endsAt: c.endsAt, durationSource: c.durationSource ?? "", closedAt: c.closedAt ?? null, status: cycleStatus(c),
        itpDate: c.itpDate ?? null, itpRequired: !!c.itpRequired, counts: { placed, quotas, attempts, bookings },
      };
    }));
    return NextResponse.json({ cycles: rows, institutions: insts.map((i) => ({ id: String(i._id), name: i.name })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = cycleInput.parse(await req.json());
    await connectDB();
    if (!(await Institution.exists({ _id: b.institutionId }))) return NextResponse.json({ error: "Institution not found" }, { status: 400 });
    await assertNoOverlap(b.institutionId, b);
    const first = !(await ProgramCycle.exists({ institutionId: b.institutionId }));
    const c = await ProgramCycle.create({ ...b, itpDate: b.itpDate ?? undefined });
    const adopted = first && cycleStatus(c) === "active" ? await adoptExisting(b.institutionId, String(c._id)) : 0;
    await audit(admin._id, "cycle.create", String(c._id), { institutionId: b.institutionId, adopted });
    return NextResponse.json({ id: String(c._id), adopted }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

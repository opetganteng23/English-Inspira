import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { cycleInput, cycleAction } from "@/lib/cycle-schemas";
import { cycleStatus } from "@/lib/cycles";
import { assertNoOverlap } from "@/lib/cycle-admin";
import { ProgramCycle } from "@/models/Cycle";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { Booking } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Program cycle not found");
  await connectDB();
  const c = await ProgramCycle.findById(id);
  if (!c) throw new HttpError(404, "Program cycle not found");
  return c;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const c = await find(params.id);
    const b = cycleInput.parse(await req.json());
    if (String(c.institutionId) !== b.institutionId) throw new HttpError(400, "A program cycle cannot move to another institution");
    await assertNoOverlap(b.institutionId, { startsAt: b.startsAt, endsAt: b.endsAt, closedAt: c.closedAt }, params.id);
    c.set({ name: b.name, startsAt: b.startsAt, endsAt: b.endsAt, durationSource: b.durationSource, itpDate: b.itpDate ?? undefined, itpRequired: b.itpRequired });
    await c.save();
    await audit(admin._id, "cycle.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Tutup periode sekarang, atau buka kembali (hanya bila belum lewat tanggal berakhir dan tidak beririsan). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const c = await find(params.id);
    const b = cycleAction.parse(await req.json());
    if (b.action === "close") {
      if (cycleStatus(c) === "closed") throw new HttpError(409, "This period is already closed");
      c.closedAt = new Date();
    } else {
      if (new Date() > c.endsAt) throw new HttpError(409, "The end date has passed. Extend the end date first, then reopen.");
      if (!c.closedAt) throw new HttpError(409, "This period was not closed manually");
      await assertNoOverlap(String(c.institutionId), { startsAt: c.startsAt, endsAt: c.endsAt }, params.id);
      c.closedAt = undefined;
    }
    await c.save();
    await audit(admin._id, `cycle.${b.action}`, params.id);
    return NextResponse.json({ ok: true, status: cycleStatus(c) });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus hanya bila belum ada data yang terhubung (histori periode tidak boleh hilang). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const c = await find(params.id);
    const [p, q, a, k] = await Promise.all([User.countDocuments({ placementCycleId: c._id }), CoachingQuota.countDocuments({ programCycleId: c._id }), Attempt.countDocuments({ programCycleId: c._id }), Booking.countDocuments({ programCycleId: c._id })]);
    if (p + q + a + k > 0) throw new HttpError(409, "This period already has participant data. Close it instead of deleting it.");
    await c.deleteOne();
    await audit(admin._id, "cycle.delete", params.id, { name: c.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

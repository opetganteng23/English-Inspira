import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { unitInput } from "@/lib/course-schemas";
import { validateUnit, syncQuizOwner } from "@/lib/unit-admin";
import { Unit, UnitProgress } from "@/models/Course";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Unit not found");
    const b = unitInput.parse(await req.json());
    await connectDB();
    const u = await Unit.findById(params.id);
    if (!u) throw new HttpError(404, "Unit not found");
    await validateUnit(b, params.id);
    u.set({ ...b, quizTestId: b.quizTestId ?? undefined });
    await u.save();
    await syncQuizOwner(u._id, b.quizTestId ?? null);
    await audit(admin._id, "unit.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Unit not found");
    await connectDB();
    if (await UnitProgress.exists({ unitId: params.id })) throw new HttpError(409, "This unit has been taken by participants. Deactivate it instead.");
    await Unit.deleteOne({ _id: params.id });
    await syncQuizOwner(params.id, null);
    await audit(admin._id, "unit.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

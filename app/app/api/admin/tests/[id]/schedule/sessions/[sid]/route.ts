import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { validateSession } from "@/lib/schedule-admin";
import { sessionBody } from "@/lib/schedule-schemas";
import { TestSeat, TestSession } from "@/models/Schedule";
import { AuditLog } from "@/models/AuditLog";

export async function PATCH(req: Request, { params }: { params: { id: string; sid: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id) || !isValidObjectId(params.sid)) throw new HttpError(404, "Session not found");
    const p = sessionBody.safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    validateSession(p.data);
    await connectDB();
    const used = await TestSeat.countDocuments({ sessionId: params.sid });
    if (p.data.capacity < used) throw new HttpError(409, `${used} people are already in this session. Move some out before lowering the capacity to ${p.data.capacity}.`);
    const s = await TestSession.findOneAndUpdate({ _id: params.sid, testId: params.id }, p.data, { returnDocument: "after" });
    if (!s) throw new HttpError(404, "Session not found");
    await AuditLog.create({ actorId: admin._id, action: "test.session_update", target: params.sid, meta: { testId: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; sid: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id) || !isValidObjectId(params.sid)) throw new HttpError(404, "Session not found");
    await connectDB();
    const invited = await TestSeat.countDocuments({ sessionId: params.sid, invitedAt: { $exists: true } });
    if (invited > 0) throw new HttpError(409, `${invited} people in this session were already invited. Move them to another session first.`);
    await TestSeat.deleteMany({ sessionId: params.sid });
    const r = await TestSession.deleteOne({ _id: params.sid, testId: params.id });
    if (!r.deletedCount) throw new HttpError(404, "Session not found");
    await AuditLog.create({ actorId: admin._id, action: "test.session_delete", target: params.sid, meta: { testId: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

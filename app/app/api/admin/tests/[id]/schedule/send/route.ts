import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { sendInvites } from "@/lib/schedule-admin";
import { Test } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const t = await Test.findById(params.id).select("scheduled").lean();
    if (!t) throw new HttpError(404, "Test not found");
    if (!t.scheduled) throw new HttpError(409, "Turn on scheduling for this test first, otherwise everyone can still open it.");
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" && isValidObjectId(body.sessionId) ? body.sessionId : undefined;
    const r = await sendInvites(params.id, sessionId);
    await AuditLog.create({ actorId: admin._id, action: "test.invites_send", target: params.id, meta: { ...r, sessionId: sessionId ?? null } });
    return NextResponse.json(r);
  } catch (e) {
    return handleError(e);
  }
}

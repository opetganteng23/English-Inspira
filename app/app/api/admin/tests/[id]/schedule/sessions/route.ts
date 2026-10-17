import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { validateSession } from "@/lib/schedule-admin";
import { sessionBody } from "@/lib/schedule-schemas";
import { TestSession } from "@/models/Schedule";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const p = sessionBody.safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    validateSession(p.data);
    await connectDB();
    const s = await TestSession.create({ testId: params.id, ...p.data });
    await AuditLog.create({ actorId: admin._id, action: "test.session_create", target: String(s._id), meta: { testId: params.id } });
    return NextResponse.json({ id: String(s._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

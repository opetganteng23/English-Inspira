import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { moveSeats } from "@/lib/schedule-admin";
import { AuditLog } from "@/models/AuditLog";

const idStr = z.string().refine(isValidObjectId, "Invalid id");

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const p = z.object({ userIds: z.array(idStr).min(1).max(5000), sessionId: idStr.nullable() }).safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    await connectDB();
    const r = await moveSeats(params.id, p.data.userIds, p.data.sessionId);
    await AuditLog.create({ actorId: admin._id, action: "test.seats_move", target: params.id, meta: { sessionId: p.data.sessionId, count: r.moved } });
    return NextResponse.json(r);
  } catch (e) {
    return handleError(e);
  }
}

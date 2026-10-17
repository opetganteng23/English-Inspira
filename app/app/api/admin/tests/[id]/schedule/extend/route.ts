import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { extendSeat } from "@/lib/schedule-admin";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const p = z.object({ userId: z.string().refine(isValidObjectId), opensAt: z.coerce.date(), closesAt: z.coerce.date(), reason: z.string().trim().min(3).max(300) }).safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    await connectDB();
    const r = await extendSeat(params.id, p.data.userId, p.data, p.data.reason, String(admin._id));
    await AuditLog.create({ actorId: admin._id, action: "test.seat_extend", target: p.data.userId, meta: { testId: params.id, opensAt: p.data.opensAt, closesAt: p.data.closesAt, reason: p.data.reason } });
    return NextResponse.json(r);
  } catch (e) {
    return handleError(e);
  }
}

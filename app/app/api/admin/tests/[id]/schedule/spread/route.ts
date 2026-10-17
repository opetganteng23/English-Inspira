import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { autoSpread } from "@/lib/schedule-admin";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const p = z.object({
      mode: z.enum(["random", "sequential", "balanced"]),
      count: z.coerce.number().int().min(1).max(100000).optional(),
      institutionId: z.string().refine(isValidObjectId).optional(),
      emails: z.array(z.string().email()).max(5000).optional(),
      seed: z.string().max(60).optional(),
    }).safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    await connectDB();
    const seed = p.data.seed || `${params.id}:${Date.now()}`;
    const r = await autoSpread(params.id, { ...p.data, seed });
    await AuditLog.create({ actorId: admin._id, action: "test.spread", target: params.id, meta: { mode: p.data.mode, seed, ...r } });
    return NextResponse.json({ ...r, seed });
  } catch (e) {
    return handleError(e);
  }
}

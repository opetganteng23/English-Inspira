import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Test } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";

/** Arsipkan atau kembalikan tes. Tes yang diarsipkan otomatis dinonaktifkan agar tidak muncul untuk peserta. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const { archived } = z.object({ archived: z.boolean() }).parse(await req.json());
    await connectDB();
    const t = await Test.findByIdAndUpdate(params.id, archived ? { archived, active: false } : { archived }, { new: true });
    if (!t) throw new HttpError(404, "Test not found");
    await AuditLog.create({ actorId: admin._id, action: archived ? "test.archive" : "test.unarchive", target: params.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

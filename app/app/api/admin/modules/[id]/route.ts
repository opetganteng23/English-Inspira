import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { moduleInput } from "@/lib/course-schemas";
import { CourseModule, Unit } from "@/models/Course";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Module not found");
    const b = moduleInput.parse(await req.json());
    await connectDB();
    const m = await CourseModule.findById(params.id);
    if (!m) throw new HttpError(404, "Module not found");
    if (String(m.courseId) !== b.courseId) throw new HttpError(400, "A module cannot move to another course");
    m.set(b);
    await m.save();
    await audit(admin._id, "module.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus modul: unit di dalamnya tidak ikut terhapus, hanya dilepas dari modul. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Module not found");
    await connectDB();
    const r = await CourseModule.deleteOne({ _id: params.id });
    if (!r.deletedCount) throw new HttpError(404, "Module not found");
    await Unit.updateMany({ moduleId: params.id }, { $unset: { moduleId: 1 } });
    await audit(admin._id, "module.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

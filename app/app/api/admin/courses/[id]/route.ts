import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { courseInput } from "@/lib/course-schemas";
import { Course, Unit } from "@/models/Course";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    const b = courseInput.parse(await req.json());
    await connectDB();
    const r = await Course.updateOne({ _id: params.id }, b);
    if (!r.matchedCount) throw new HttpError(404, "Course not found");
    await audit(admin._id, "course.update", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Course not found");
    await connectDB();
    if (await Unit.exists({ courseId: params.id })) throw new HttpError(409, "This course still has units. Delete its units first or deactivate the course.");
    await Course.deleteOne({ _id: params.id });
    await audit(admin._id, "course.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

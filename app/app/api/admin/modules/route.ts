import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { moduleInput } from "@/lib/course-schemas";
import { Course, CourseModule } from "@/models/Course";

export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = moduleInput.parse(await req.json());
    await connectDB();
    if (!(await Course.exists({ _id: b.courseId }))) throw new HttpError(400, "Course not found");
    const m = await CourseModule.create(b);
    await audit(admin._id, "module.create", String(m._id));
    return NextResponse.json({ id: String(m._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

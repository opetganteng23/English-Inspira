import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { courseInput } from "@/lib/course-schemas";
import { getLevels } from "@/lib/config";
import { Course, CourseModule, Unit } from "@/models/Course";
import { checkCourseRefs } from "@/lib/course-admin";
import { Material } from "@/models/Material";
import { Test } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Struktur lengkap untuk editor admin: course per level beserta unit, materi, dan kuisnya. */
export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const [levels, courses, units, modules, materials, quizzes] = await Promise.all([
      getLevels(),
      Course.find().sort({ order: 1, createdAt: 1 }).lean(),
      Unit.find().sort({ order: 1, createdAt: 1 }).lean(),
      CourseModule.find().sort({ order: 1, createdAt: 1 }).lean(),
      Material.find().select("title status kind").sort({ title: 1 }).lean(),
      Test.find({ kind: "quiz" }).select("name levelId unitId active").lean(),
    ]);
    return NextResponse.json({
      levels: levels.map((l) => ({ id: String(l._id), name: l.name, order: l.order })),
      materials: materials.map((m) => ({ id: String(m._id), title: m.title, status: m.status, kind: m.kind })),
      quizzes: quizzes.map((q) => ({ id: String(q._id), name: q.name, unitId: q.unitId ? String(q.unitId) : null, active: q.active })),
      courses: courses.map((c) => ({
        id: String(c._id), levelId: String(c.levelId), title: c.title, description: c.description ?? "", order: c.order, active: c.active,
        archived: !!c.archived, secureMode: !!c.secureMode, coverAssetId: c.coverAssetId ? String(c.coverAssetId) : null, prerequisiteCourseIds: (c.prerequisiteCourseIds ?? []).map(String),
        modules: modules.filter((m) => String(m.courseId) === String(c._id)).map((m) => ({ id: String(m._id), title: m.title, description: m.description ?? "", order: m.order, active: m.active })),
        units: units.filter((u) => String(u.courseId) === String(c._id)).map((u) => ({
          id: String(u._id), title: u.title, description: u.description ?? "", order: u.order, active: u.active,
          moduleId: u.moduleId ? String(u.moduleId) : null, unlockAfterDays: u.unlockAfterDays ?? 0,
          materialIds: u.materialIds.map(String), quizTestId: u.quizTestId ? String(u.quizTestId) : null,
        })),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = courseInput.parse(await req.json());
    await connectDB();
    await checkCourseRefs(b);
    const c = await Course.create({ ...b, coverAssetId: b.coverAssetId ?? undefined });
    await audit(admin._id, "course.create", String(c._id));
    return NextResponse.json({ id: String(c._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

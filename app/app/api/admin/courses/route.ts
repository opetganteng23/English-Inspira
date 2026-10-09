import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { courseInput } from "@/lib/course-schemas";
import { getLevels } from "@/lib/config";
import { Course, Unit } from "@/models/Course";
import { Material } from "@/models/Material";
import { Test } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Struktur lengkap untuk editor admin: course per level beserta unit, materi, dan kuisnya. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [levels, courses, units, materials, quizzes] = await Promise.all([
      getLevels(),
      Course.find().sort({ order: 1, createdAt: 1 }).lean(),
      Unit.find().sort({ order: 1, createdAt: 1 }).lean(),
      Material.find().select("title status kind").sort({ title: 1 }).lean(),
      Test.find({ kind: "quiz" }).select("name levelId unitId active").lean(),
    ]);
    return NextResponse.json({
      levels: levels.map((l) => ({ id: String(l._id), name: l.name, order: l.order })),
      materials: materials.map((m) => ({ id: String(m._id), title: m.title, status: m.status, kind: m.kind })),
      quizzes: quizzes.map((q) => ({ id: String(q._id), name: q.name, unitId: q.unitId ? String(q.unitId) : null, active: q.active })),
      courses: courses.map((c) => ({
        id: String(c._id), levelId: String(c.levelId), title: c.title, description: c.description ?? "", order: c.order, active: c.active,
        units: units.filter((u) => String(u.courseId) === String(c._id)).map((u) => ({
          id: String(u._id), title: u.title, description: u.description ?? "", order: u.order, active: u.active,
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
    const admin = await requireRole(["admin"]);
    const b = courseInput.parse(await req.json());
    await connectDB();
    const c = await Course.create(b);
    await audit(admin._id, "course.create", String(c._id));
    return NextResponse.json({ id: String(c._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Course, RemedialMap, Unit } from "@/models/Course";
import { Question } from "@/models/Question";

export const dynamic = "force-dynamic";

/** Peta remedial + daftar topik yang dikenal (dari tag soal) dan unit yang bisa dipilih. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [maps, units, courses, tags] = await Promise.all([
      RemedialMap.find().sort({ skill: 1, topic: 1 }).lean(), Unit.find().select("title courseId").lean(), Course.find().select("title").lean(),
      Question.aggregate([{ $unwind: "$tags" }, { $group: { _id: { skill: "$tags.skill", topic: "$tags.topic" }, n: { $sum: 1 } } }, { $sort: { "_id.skill": 1, "_id.topic": 1 } }]),
    ]);
    const cn = new Map(courses.map((c) => [String(c._id), c.title])), un = new Map(units.map((u) => [String(u._id), `${cn.get(String(u.courseId)) ?? "?"} › ${u.title}`]));
    return NextResponse.json({
      entries: maps.map((m) => ({ id: String(m._id), skill: m.skill, topic: m.topic, unitId: String(m.unitId), unit: un.get(String(m.unitId)) ?? "(unit deleted)" })),
      units: units.map((u) => ({ id: String(u._id), label: un.get(String(u._id)) ?? u.title })),
      topics: tags.map((t) => ({ skill: t._id.skill, topic: t._id.topic, questions: t.n })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const body = z.object({ skill: z.string().trim().min(1).max(40), topic: z.string().trim().min(1).max(60), unitId: z.string().regex(/^[0-9a-f]{24}$/) });

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = body.parse(await req.json());
    await connectDB();
    if (!(await Unit.exists({ _id: b.unitId }))) throw new HttpError(400, "Unit not found");
    if (await RemedialMap.exists(b)) throw new HttpError(409, "This mapping already exists");
    const m = await RemedialMap.create(b);
    await audit(admin._id, "remedial.create", String(m._id), b);
    return NextResponse.json({ id: String(m._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

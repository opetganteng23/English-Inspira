import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { ensureQuestionTypes } from "@/lib/question-types";
import { Question, QuestionType, SECTIONS } from "@/models/Question";

export const dynamic = "force-dynamic";

/** Daftar jenis soal per kategori beserta jumlah soal yang memakainya. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await ensureQuestionTypes();
    const [types, counts] = await Promise.all([
      QuestionType.find().sort({ section: 1, order: 1, name: 1 }).lean(),
      Question.aggregate<{ _id: { section: string; type: string }; n: number }>([{ $group: { _id: { section: "$section", type: "$type" }, n: { $sum: 1 } } }]),
    ]);
    const key = (s: string, t: string) => `${s}|${t.toLowerCase()}`;
    const by = new Map(counts.map((c) => [key(c._id.section, c._id.type), c.n]));
    const sectionCounts: Record<string, number> = {};
    for (const c of counts) sectionCounts[c._id.section] = (sectionCounts[c._id.section] ?? 0) + c.n;
    return NextResponse.json({
      types: types.map((t) => ({ id: String(t._id), section: t.section, name: t.name, description: t.description ?? "", order: t.order, active: t.active, count: by.get(key(t.section, t.name)) ?? 0 })),
      sectionCounts,
    });
  } catch (e) {
    return handleError(e);
  }
}

const createInput = z.object({ section: z.enum(SECTIONS), name: z.string().trim().min(1, "Enter a type name").max(80), description: z.string().trim().max(300).optional() });

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = createInput.parse(await req.json());
    await connectDB();
    if (await QuestionType.findOne({ section: b.section, name: b.name }).collation({ locale: "en", strength: 2 })) throw new HttpError(409, "A type with this name already exists in this category");
    const order = (await QuestionType.countDocuments({ section: b.section })) + 1;
    const t = await QuestionType.create({ ...b, order });
    await audit(admin._id, "question_type.create", String(t._id), { section: b.section, name: b.name });
    return NextResponse.json({ id: String(t._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

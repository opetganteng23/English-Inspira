import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { sanitizePassage } from "@/lib/sanitize";
import { Audio } from "@/models/Audio";
import { QuestionGroup, Question } from "@/models/Question";
import { groupSchema } from "@/lib/admin-schemas";


export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const section = new URL(req.url).searchParams.get("section");
    const groups = await QuestionGroup.find(section ? ({ section } as Record<string, unknown>) : {}).sort({ createdAt: -1 }).limit(200).lean();
    const counts = await Question.aggregate([{ $match: { groupId: { $in: groups.map((g) => g._id) } } }, { $group: { _id: "$groupId", n: { $sum: 1 } } }]);
    const n = new Map(counts.map((c) => [String(c._id), c.n]));
    return NextResponse.json({
      groups: groups.map((g) => ({ id: String(g._id), section: g.section, instruction: g.instruction, passageTitle: g.passageTitle, audioId: g.audioId ? String(g.audioId) : null, questions: n.get(String(g._id)) ?? 0 })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
    const b = groupSchema.parse(await req.json());
    await connectDB();
    if (b.audioId && !(await Audio.exists({ _id: b.audioId }))) return NextResponse.json({ error: "Audio not found" }, { status: 400 });
    const g = await QuestionGroup.create({ ...b, audioId: b.audioId ?? undefined, passageHtml: b.passageHtml ? sanitizePassage(b.passageHtml) : undefined });
    return NextResponse.json({ id: String(g._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";

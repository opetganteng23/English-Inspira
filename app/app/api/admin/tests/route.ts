import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { testSchema } from "@/lib/admin-schemas";
import { validateTestQuestions } from "@/lib/test-validate";
import { Test, Attempt } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const tests = await Test.find().sort({ createdAt: -1 }).lean();
    const counts = await Attempt.aggregate([{ $group: { _id: "$testId", n: { $sum: 1 } } }]);
    const n = new Map(counts.map((c) => [String(c._id), c.n]));
    return NextResponse.json({
      tests: tests.map((t) => ({
        id: String(t._id), name: t.name, kind: t.kind, active: t.active,
        questions: t.sections.reduce((a, s) => a + s.questionIds.length, 0),
        durationSec: t.sections.reduce((a, s) => a + s.durationSec, 0),
        attempts: n.get(String(t._id)) ?? 0,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const body = testSchema.parse(await req.json());
    await connectDB();
    await validateTestQuestions(body.sections);
    const t = await Test.create(body);
    await AuditLog.create({ actorId: admin._id, action: "test.create", target: String(t._id) });
    return NextResponse.json({ id: String(t._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";

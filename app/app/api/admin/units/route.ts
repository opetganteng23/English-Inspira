import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { unitInput } from "@/lib/course-schemas";
import { validateUnit, syncQuizOwner } from "@/lib/unit-admin";
import { Unit } from "@/models/Course";

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = unitInput.parse(await req.json());
    await connectDB();
    await validateUnit(b);
    const u = await Unit.create({ ...b, quizTestId: b.quizTestId ?? undefined });
    await syncQuizOwner(u._id, b.quizTestId ?? null);
    await audit(admin._id, "unit.create", String(u._id));
    return NextResponse.json({ id: String(u._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

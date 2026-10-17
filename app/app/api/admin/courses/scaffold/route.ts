import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { scaffoldLevel } from "@/lib/course-scaffold";
import { Level } from "@/models/Config";

/** Buat kerangka course baku (6 bagian TOEFL ITP) untuk satu level. Course dibuat Preview only. */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const p = z.object({ levelId: z.string().regex(/^[0-9a-f]{24}$/) }).safeParse(await req.json());
    if (!p.success) throw new HttpError(422, zodMessage(p.error));
    await connectDB();
    if (!(await Level.exists({ _id: p.data.levelId }))) throw new HttpError(404, "Level not found");
    const r = await scaffoldLevel(p.data.levelId);
    await audit(admin._id, "course.scaffold", p.data.levelId, r);
    return NextResponse.json(r);
  } catch (e) {
    return handleError(e);
  }
}

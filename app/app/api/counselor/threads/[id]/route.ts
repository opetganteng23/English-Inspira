import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId, type Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { counselorAccess } from "@/lib/counselor-access";
import { CounselorThread } from "@/models/Counselor";
import { Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

async function mine(id: string, userId: Types.ObjectId) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Percakapan tidak ditemukan");
  await connectDB();
  const t = await CounselorThread.findOne({ _id: id, userId });
  if (!t) throw new HttpError(404, "Percakapan tidak ditemukan");
  return t;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const t = await mine(params.id, user._id);
    const a = t.attemptId ? await Attempt.findById(t.attemptId).select("kind scoreEst sectionScores finishedAt").lean() : null;
    return NextResponse.json({
      id: String(t._id), title: t.title, helpful: t.helpful ?? null,
      messages: t.messages.map((m) => ({ role: m.role, content: m.content, at: m.at })),
      actionPlan: t.actionPlan.map((p) => ({ id: String(p._id), text: p.text, done: p.done, dueAt: p.dueAt ?? null })),
      basis: a ? { kind: a.kind, scoreEst: a.scoreEst, sections: a.sectionScores, finishedAt: a.finishedAt, attemptId: String(t.attemptId) } : null,
      access: await counselorAccess(user._id),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const t = await mine(params.id, user._id);
    const b = z.object({ helpful: z.boolean() }).parse(await req.json());
    t.helpful = b.helpful;
    await t.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

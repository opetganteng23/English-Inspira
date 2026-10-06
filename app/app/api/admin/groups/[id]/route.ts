import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { sanitizePassage } from "@/lib/sanitize";
import { QuestionGroup, Question } from "@/models/Question";
import { groupSchema } from "@/lib/admin-schemas";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Grup tidak ditemukan");
  await connectDB();
  const g = await QuestionGroup.findById(id);
  if (!g) throw new HttpError(404, "Grup tidak ditemukan");
  return g;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    return NextResponse.json((await find(params.id)).toObject());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    const g = await find(params.id);
    const b = groupSchema.parse(await req.json());
    g.set({ ...b, audioId: b.audioId ?? undefined, passageHtml: b.passageHtml ? sanitizePassage(b.passageHtml) : undefined });
    await g.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    const g = await find(params.id);
    if (await Question.exists({ groupId: g._id })) throw new HttpError(409, "Grup masih dipakai soal");
    await g.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

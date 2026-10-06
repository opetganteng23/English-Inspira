import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { testSchema } from "@/lib/admin-schemas";
import { validateTestQuestions } from "@/lib/test-validate";
import { Test, Attempt } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Tes tidak ditemukan");
  await connectDB();
  const t = await Test.findById(id);
  if (!t) throw new HttpError(404, "Tes tidak ditemukan");
  return t;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    const t = await find(params.id);
    const attempts = await Attempt.countDocuments({ testId: t._id });
    return NextResponse.json({ ...t.toObject(), attempts });
  } catch (e) {
    return handleError(e);
  }
}

const sameStructure = (a: { name: string; durationSec: number; questionIds: unknown[] }[], b: typeof a) =>
  JSON.stringify(a.map((s) => [s.name, s.durationSec, s.questionIds.map(String)])) ===
  JSON.stringify(b.map((s) => [s.name, s.durationSec, s.questionIds.map(String)]));

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const t = await find(params.id);
    const body = testSchema.parse(await req.json());
    const attempts = await Attempt.countDocuments({ testId: t._id });
    // Tes yang sudah dikerjakan: susunan soal dan durasi dikunci agar skor/pembahasan lama tetap valid.
    if (attempts > 0 && (t.kind !== body.kind || !sameStructure(t.sections, body.sections)))
      throw new HttpError(409, `Tes sudah dikerjakan ${attempts}×. Susunan soal tidak bisa diubah; nonaktifkan lalu buat tes baru.`);
    if (attempts === 0) await validateTestQuestions(body.sections);
    t.set(body);
    await t.save();
    await AuditLog.create({ actorId: admin._id, action: "test.update", target: params.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const t = await find(params.id);
    if (await Attempt.exists({ testId: t._id })) throw new HttpError(409, "Tes sudah dikerjakan. Nonaktifkan saja, jangan dihapus.");
    await t.deleteOne();
    await AuditLog.create({ actorId: admin._id, action: "test.delete", target: params.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

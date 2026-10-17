import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { User } from "@/models/User";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { testSchema } from "@/lib/admin-schemas";
import { validateTestQuestions } from "@/lib/test-validate";
import { Test, Attempt } from "@/models/Test";
import { TestSeat, TestSession } from "@/models/Schedule";
import { AuditLog } from "@/models/AuditLog";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Test not found");
  await connectDB();
  const t = await Test.findById(id);
  if (!t) throw new HttpError(404, "Test not found");
  return t;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const t = await find(params.id);
    const attempts = await realAttemptCount(t._id);
    return NextResponse.json({ ...t.toObject(), attempts });
  } catch (e) {
    return handleError(e);
  }
}

/** Percobaan peserta sungguhan. Percobaan QA tester dan admin (uji coba di Test mode) tidak mengunci susunan tes. */
async function realAttemptCount(testId: Types.ObjectId) {
  const staff = await User.find({ $or: [{ qaTester: true }, { role: "admin" }] }).select("_id").lean();
  return Attempt.countDocuments({ testId, userId: { $nin: staff.map((u) => u._id) } });
}

/** Peserta sungguhan yang sedang mengerjakan tes ini. Mengubah pengacakan soal saat itu akan menggeser urutan di tengah pengerjaan. */
async function realInProgress(testId: Types.ObjectId) {
  const staff = await User.find({ $or: [{ qaTester: true }, { role: "admin" }] }).select("_id").lean();
  return Attempt.exists({ testId, status: "in_progress", userId: { $nin: staff.map((u) => u._id) } });
}

const sameStructure = (a: { name: string; durationSec: number; questionIds: unknown[] }[], b: typeof a) =>
  JSON.stringify(a.map((s) => [s.name, s.durationSec, s.questionIds.map(String)])) ===
  JSON.stringify(b.map((s) => [s.name, s.durationSec, s.questionIds.map(String)]));

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const t = await find(params.id);
    const body = testSchema.parse(await req.json());
    const attempts = await realAttemptCount(t._id);
    // Tes yang sudah dikerjakan: susunan soal dan durasi dikunci agar skor/pembahasan lama tetap valid.
    if (attempts > 0 && (t.kind !== body.kind || !sameStructure(t.sections, body.sections)))
      throw new HttpError(409, `This test has been taken ${attempts} times. The question set cannot be changed; deactivate it and create a new test.`);
    body.shuffleQuestions = body.shuffleQuestions && !body.shuffleWithinParts; // dua mode acak tidak dipakai bersamaan
    if ((!!t.shuffleQuestions !== body.shuffleQuestions || !!t.shuffleWithinParts !== body.shuffleWithinParts) && (await realInProgress(t._id)))
      throw new HttpError(409, "Question shuffling cannot be changed while participants are taking this test.");
    if (attempts > 0 && !!t.shuffleOptions !== body.shuffleOptions) throw new HttpError(409, "Answer-option shuffling cannot be changed after the test has been taken.");
    if (attempts === 0) await validateTestQuestions(body.sections);
    t.set(body);
    await t.save();
    await AuditLog.create({ actorId: admin._id, action: "test.update", target: params.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const t = await find(params.id);
    if (await Attempt.exists({ testId: t._id })) throw new HttpError(409, "This test has been taken. Deactivate it instead of deleting it.");
    await t.deleteOne();
    await Promise.all([TestSeat.deleteMany({ testId: t._id }), TestSession.deleteMany({ testId: t._id })]); // jadwal dan kursi tes yang dihapus ikut dibersihkan
    await AuditLog.create({ actorId: admin._id, action: "test.delete", target: params.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

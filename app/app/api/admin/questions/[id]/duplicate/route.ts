import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { recordQuestionVersion } from "@/lib/question-versions";
import { Question } from "@/models/Question";

/** Duplikat soal sebagai draf baru (kunci, pilihan, tag, dan grup ikut disalin) untuk dipakai ulang dan diubah. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Question not found");
    await connectDB();
    const q = await Question.findById(params.id).lean();
    if (!q) throw new HttpError(404, "Question not found");
    const copy = await Question.create({
      section: q.section, type: q.type, groupId: q.groupId, stem: q.stem, options: q.options, answerKey: q.answerKey, explanation: q.explanation,
      tags: q.tags, assetIds: q.assetIds, difficulty: q.difficulty, source: q.source, status: "draft",
    });
    await recordQuestionVersion(copy._id, copy.toObject(), admin._id, `Duplicated from ${params.id}`);
    await audit(admin._id, "question.duplicate", String(copy._id), { from: params.id });
    return NextResponse.json({ id: String(copy._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

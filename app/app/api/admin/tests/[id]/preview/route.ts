import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Test } from "@/models/Test";
import { Question, QuestionGroup } from "@/models/Question";

export const dynamic = "force-dynamic";

/** Isi lengkap tes untuk pratinjau admin (dengan kunci jawaban). Tidak membuat attempt; penilaian dilakukan di browser. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const t = await Test.findById(params.id).lean();
    if (!t) throw new HttpError(404, "Test not found");
    const ids = t.sections.flatMap((s) => s.questionIds);
    const qs = await Question.find({ _id: { $in: ids } }).select("section type groupId stem options answerKey explanation assetIds").lean();
    const gids = Array.from(new Set(qs.map((q) => q.groupId).filter(Boolean).map(String)));
    const groups = await QuestionGroup.find({ _id: { $in: gids } }).select("instruction audioId passageTitle passageHtml assetIds").lean();
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    return NextResponse.json({
      name: t.name,
      sections: t.sections.map((s) => ({
        name: s.name, durationSec: s.durationSec,
        questions: s.questionIds.map((id) => byId.get(String(id))).filter(Boolean).map((q) => ({
          id: String(q!._id), type: q!.type, groupId: q!.groupId ? String(q!.groupId) : null, stem: q!.stem,
          options: q!.options, answerKey: q!.answerKey, explanation: q!.explanation ?? "", assetIds: (q!.assetIds ?? []).map(String),
        })),
      })),
      groups: Object.fromEntries(groups.map((g) => [String(g._id), { instruction: g.instruction ?? "", audioId: g.audioId ? String(g.audioId) : null, passageTitle: g.passageTitle ?? "", passageHtml: g.passageHtml ?? "", assetIds: (g.assetIds ?? []).map(String) }])),
    });
  } catch (e) {
    return handleError(e);
  }
}

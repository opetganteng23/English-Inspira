import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { Question, QuestionGroup } from "@/models/Question";
import { Test } from "@/models/Test";
import { User } from "@/models/User";
import { QuestionVersion, FIELDS, recordQuestionVersion, ensureBaseline } from "@/lib/question-versions";
import { registerQuestionType } from "@/lib/question-types";

export const dynamic = "force-dynamic";

async function ensure(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Question not found");
  await connectDB();
}

/** Riwayat versi soal (terbaru dulu): siapa, kapan, kolom yang berubah, dan salinan lengkapnya untuk perbandingan. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CONTENT_ROLES);
    await ensure(params.id);
    const versions = await QuestionVersion.find({ questionId: params.id }).sort({ version: -1 }).limit(100).lean();
    const actors = new Map((await User.find({ _id: { $in: versions.map((v) => v.actorId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    return NextResponse.json({
      versions: versions.map((v) => ({ version: v.version, at: v.at, changed: v.changed, note: v.note ?? "", actor: v.actorId ? (actors.get(String(v.actorId))?.name || actors.get(String(v.actorId))?.email || "Unknown") : "System", snapshot: v.snapshot })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const restoreInput = z.object({ version: z.number().int().min(1) });

/** Pulihkan soal ke salinan sebuah versi lama. Pemulihan sendiri tercatat sebagai versi baru (riwayat tidak pernah ditimpa). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(CONTENT_ROLES);
    await ensure(params.id);
    const { version } = restoreInput.parse(await req.json());
    const v = await QuestionVersion.findOne({ questionId: params.id, version }).lean();
    if (!v) throw new HttpError(404, "Version not found");
    const q = await Question.findById(params.id);
    if (!q) throw new HttpError(404, "Question not found");
    await ensureBaseline(q._id, q.toObject());
    const snap = { ...(v.snapshot as Record<string, unknown>) };
    if (snap.groupId && !(await QuestionGroup.exists({ _id: snap.groupId as string }))) snap.groupId = null; // grup sudah dihapus
    const set: Record<string, unknown> = {};
    for (const f of FIELDS) if (f in snap) set[f] = snap[f] ?? undefined;
    if (set.groupId === null) set.groupId = undefined;
    q.set(set);
    await q.save();
    await registerQuestionType(q.section, q.type);
    const used = await Test.exists({ "sections.questionIds": q._id });
    const rec = await recordQuestionVersion(q._id, q.toObject(), admin._id, `Restored version ${version}`);
    await audit(admin._id, "question.restore", params.id, { fromVersion: version, newVersion: rec?.version, usedInTest: !!used });
    return NextResponse.json({ ok: true, version: rec?.version ?? null, usedInTest: !!used });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

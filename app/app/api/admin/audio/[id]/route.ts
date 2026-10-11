import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { Audio } from "@/models/Audio";
import { Material } from "@/models/Material";
import { Question, QuestionGroup } from "@/models/Question";

export const dynamic = "force-dynamic";

/** Detail satu audio: metadata, transkrip, dan semua soal serta materi yang memakainya (untuk peringatan sebelum ganti atau hapus). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CONTENT_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Audio not found");
    await connectDB();
    const a = await Audio.findById(params.id).lean();
    if (!a) throw new HttpError(404, "Audio not found");
    const groups = await QuestionGroup.find({ audioId: a._id }).select("section instruction").lean();
    const [questions, materials] = await Promise.all([
      groups.length ? Question.find({ groupId: { $in: groups.map((g) => g._id) } }).select("section type stem status").limit(100).lean() : [],
      Material.find({ contentHtml: { $regex: `data-audio-id="${String(a._id)}"` } }).select("title status").limit(100).lean(),
    ]);
    return NextResponse.json({
      id: String(a._id), title: a.title, kind: a.kind ?? "other", description: a.description ?? "", source: a.source ?? "", transcript: a.transcript ?? "", mime: a.mime ?? "audio/mpeg", peaks: a.peaks ?? [], markers: (a.markers ?? []).map((m) => ({ t: m.t, label: m.label })),
      durationSec: a.durationSec, size: a.size, createdAt: a.createdAt,
      groups: groups.map((g) => ({ id: String(g._id), section: g.section, instruction: g.instruction ?? "" })),
      questions: questions.map((q) => ({ id: String(q._id), section: q.section, type: q.type, stem: q.stem.slice(0, 120), status: q.status })),
      materials: materials.map((m) => ({ id: String(m._id), title: m.title, status: m.status })),
    });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, CONTENT_ROLES } from "@/lib/rbac";
import { Audio } from "@/models/Audio";
import { Material } from "@/models/Material";
import { Question, QuestionGroup } from "@/models/Question";

export const dynamic = "force-dynamic";

const ID = /data-audio-id="([0-9a-f]{24})"/g;

/** Daftar audio untuk Audio Library dan pemilih audio di editor: jenis, durasi, ukuran, dan pemakaian (grup soal, soal, materi). */
export async function GET() {
  try {
    await requireRole(CONTENT_ROLES); // penulis materi perlu daftar audio untuk menyisipkan pemutar
    await connectDB();
    const list = await Audio.find().select("title durationSec size transcript kind description source createdAt").sort({ createdAt: -1 }).limit(500).lean();
    const ids = list.map((a) => a._id);
    const groups = await QuestionGroup.find({ audioId: { $in: ids } }).select("audioId").lean();
    const groupIds = groups.map((g) => g._id);
    const qByGroup = new Map<string, number>();
    if (groupIds.length) for (const r of await Question.aggregate<{ _id: unknown; n: number }>([{ $match: { groupId: { $in: groupIds } } }, { $group: { _id: "$groupId", n: { $sum: 1 } } }])) qByGroup.set(String(r._id), r.n);
    const groupsOf = new Map<string, number>(), questionsOf = new Map<string, number>();
    for (const g of groups) {
      const k = String(g.audioId);
      groupsOf.set(k, (groupsOf.get(k) ?? 0) + 1);
      questionsOf.set(k, (questionsOf.get(k) ?? 0) + (qByGroup.get(String(g._id)) ?? 0));
    }
    const materialsOf = new Map<string, number>();
    for (const m of await Material.find({ contentHtml: { $regex: "data-audio-id=" } }).select("contentHtml").lean()) {
      for (const id of new Set(Array.from((m.contentHtml ?? "").matchAll(ID), (x) => x[1]))) materialsOf.set(id, (materialsOf.get(id) ?? 0) + 1);
    }
    return NextResponse.json({
      audio: list.map((a) => {
        const k = String(a._id);
        const g = groupsOf.get(k) ?? 0, q = questionsOf.get(k) ?? 0, m = materialsOf.get(k) ?? 0;
        return { id: k, title: a.title, kind: a.kind ?? "other", description: a.description ?? "", source: a.source ?? "", durationSec: a.durationSec, size: a.size, hasTranscript: !!a.transcript, createdAt: a.createdAt, inUse: g + m > 0, usage: { groups: g, questions: q, materials: m } };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

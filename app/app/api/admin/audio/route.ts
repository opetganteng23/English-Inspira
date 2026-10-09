import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handleError } from "@/lib/rbac";
import { requireAuthor } from "@/lib/material-authz";
import { Audio } from "@/models/Audio";
import { QuestionGroup } from "@/models/Question";

export async function GET() {
  try {
    await requireAuthor(); // penulis materi perlu daftar audio untuk menyisipkan pemutar
    await connectDB();
    const list = await Audio.find().select("title durationSec size transcript createdAt").sort({ createdAt: -1 }).limit(200).lean();
    const used = new Set((await QuestionGroup.find({ audioId: { $in: list.map((a) => a._id) } }).select("audioId").lean()).map((g) => String(g.audioId)));
    return NextResponse.json({
      audio: list.map((a) => ({ id: String(a._id), title: a.title, durationSec: a.durationSec, size: a.size, hasTranscript: !!a.transcript, inUse: used.has(String(a._id)) })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";

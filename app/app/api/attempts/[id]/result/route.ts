import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { Question, QuestionGroup } from "@/models/Question";
import { Audio } from "@/models/Audio";
import { Level } from "@/models/Config";
import { User } from "@/models/User";
import { Analysis } from "@/models/Learning";

export const dynamic = "force-dynamic";

/** Hasil tes yang sudah selesai: skor, pembahasan semua soal, topik, transkrip audio (hanya setelah tes selesai). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "Tes belum selesai");
    await connectDB();

    const ids = test.sections.flatMap((s) => s.questionIds);
    const qs = await Question.find({ _id: { $in: ids } }).select("section type groupId stem options answerKey explanation tags").lean();
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const mine = new Map(attempt.answers.map((a) => [String(a.qid), a]));

    const review = ids.map((id, i) => {
      const q = byId.get(String(id))!;
      const a = mine.get(String(id));
      return {
        no: i + 1, section: q.section, type: q.type, tags: q.tags, groupId: q.groupId ? String(q.groupId) : null,
        correct: a?.choice === q.answerKey, answered: a?.choice != null, changes: a?.changes ?? 0, timeSpentSec: a?.timeSpentSec ?? null,
        stem: q.stem, options: q.options, yourChoice: a?.choice ?? null, answerKey: q.answerKey, explanation: q.explanation,
      };
    });

    // Transkrip audio dibuka setelah tes selesai sebagai pembahasan (tidak pernah sebelum itu).
    const groupIds = Array.from(new Set(qs.map((q) => q.groupId).filter((g): g is NonNullable<typeof g> => !!g).map(String)));
    const groups = await QuestionGroup.find({ _id: { $in: groupIds }, audioId: { $exists: true } }).select("audioId").lean();
    const audios = await Audio.find({ _id: { $in: groups.map((g) => g.audioId) } }).select("title transcript").lean();
    const aById = new Map(audios.map((a) => [String(a._id), a]));
    const transcripts = groups.filter((g) => g.audioId && aById.get(String(g.audioId))?.transcript).map((g) => ({ groupId: String(g._id), title: aById.get(String(g.audioId))!.title, text: aById.get(String(g.audioId))!.transcript }));

    const u = await User.findById(attempt.userId).select("currentLevelId targetScore").lean();
    const level = attempt.kind === "placement" && u?.currentLevelId ? await Level.findById(u.currentLevelId).select("name coachingQuota scoreMin scoreMax").lean() : null;

    const calc = (await Analysis.findOne({ attemptId: attempt._id }).select("calculated").lean())?.calculated as { levelUp?: { up: boolean; reasons: string[]; level?: string }; stuck?: string[] } | undefined;
    return NextResponse.json({
      levelUp: calc?.levelUp ?? null, stuck: (calc?.stuck ?? []).map((k) => k.split("|")[1] ?? k),
      kind: attempt.kind, testName: test.name, finishedAt: attempt.finishedAt,
      durationSec: attempt.finishedAt ? Math.round((+attempt.finishedAt - +attempt.startedAt) / 1000) : null,
      scoreRaw: attempt.scoreRaw, scoreEst: attempt.scoreEst, sectionScores: attempt.sectionScores, topicScores: attempt.topicScores,
      flags: attempt.proctorFlags.length, attemptId: String(attempt._id), analysis: attempt.aiAnalysis ?? { status: "pending" },
      level: level ? { name: level.name, quota: level.coachingQuota, scoreMin: level.scoreMin, scoreMax: level.scoreMax } : null,
      review, transcripts,
    });
  } catch (e) {
    return handleError(e);
  }
}

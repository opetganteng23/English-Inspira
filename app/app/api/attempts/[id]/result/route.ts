import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { Question, QuestionGroup } from "@/models/Question";
import { Audio } from "@/models/Audio";
import { Level } from "@/models/Config";
import { User } from "@/models/User";
import { Analysis } from "@/models/Learning";
import { recommendCourses } from "@/lib/units";
import { Attempt, Test, AttemptSnapshot } from "@/models/Test";
import { Certificate } from "@/models/Itp";
import { ScoringProfile } from "@/models/Scoring";

export const dynamic = "force-dynamic";

type SnapItem = { qid: import("mongoose").Types.ObjectId; section: string; type: string; groupId?: import("mongoose").Types.ObjectId; stem: string; options: string[]; answerKey: number; explanation?: string; tags: { skill: string; topic: string }[] };

/** Hasil tes yang sudah selesai: skor, pembahasan semua soal, topik, transkrip audio (hanya setelah tes selesai). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    await connectDB();

    const ids = test.sections.flatMap((s) => s.questionIds);
    // Pembahasan memakai snapshot saat tes diselesaikan (konsisten dengan skor walau soal diubah/dihapus kemudian);
    // tes lama tanpa snapshot memakai soal yang ada sekarang.
    const snap = await AttemptSnapshot.findOne({ attemptId: attempt._id }).lean();
    const qs = snap
      ? (snap.items as unknown as SnapItem[]).map((i) => ({ _id: i.qid, section: i.section, type: i.type, groupId: i.groupId, stem: i.stem, options: i.options, answerKey: i.answerKey, explanation: i.explanation, tags: i.tags }))
      : await Question.find({ _id: { $in: ids } }).select("section type groupId stem options answerKey explanation tags").lean();
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const mine = new Map(attempt.answers.map((a) => [String(a.qid), a]));

    const review = ids.map((id, i) => {
      const q = byId.get(String(id));
      const a = mine.get(String(id));
      if (!q) return { no: i + 1, section: "listening", type: "-", tags: [], groupId: null, correct: false, answered: a?.choice != null, changes: 0, timeSpentSec: a?.timeSpentSec ?? null, stem: "This question is no longer available.", options: [] as string[], yourChoice: a?.choice ?? null, answerKey: -1, explanation: "" };
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
    // Tes sebelumnya (selesai) milik peserta yang sama, untuk selisih skor; laporan PDF bila sudah dibuat.
    const prev = await Attempt.findOne({ userId: attempt.userId, status: "submitted", kind: { $ne: "trial" }, finishedAt: { $lt: attempt.finishedAt }, _id: { $ne: attempt._id } })
      .sort({ finishedAt: -1 }).select("testId scoreEst sectionScores topicScores").lean();
    const prevTest = prev ? await Test.findById(prev.testId).select("name").lean() : null;
    const sp = attempt.scoringProfileId ? await ScoringProfile.findById(attempt.scoringProfileId).select("name").lean() : null;
    const scoringInfo = { name: sp?.name ?? null, version: attempt.scoringVersion ?? null, basis: attempt.scoreBasis ?? "provisional" };
    const report = await Certificate.findOne({ attemptId: attempt._id, type: "sim_report" }).select("_id").lean();
    // Topik terlemah (cukup data, di bawah 70%) -> unit remedial yang disarankan untuk dipelajari.
    const weak = (attempt.topicScores ?? [])
      .map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", score: Math.round(t.score ?? 0), correct: t.correct ?? 0, total: t.total ?? 0 }))
      .filter((t) => t.skill && t.topic && t.total >= 2 && t.score < 70).sort((x, y) => x.score - y.score).slice(0, 5);
    const recommendations = await recommendCourses(attempt.userId, u?.currentLevelId, weak);
    return NextResponse.json({
      recommendations,
      previous: prev ? { name: prevTest?.name ?? "Previous test", scoreEst: prev.scoreEst, sectionScores: prev.sectionScores, topicScores: prev.topicScores } : null,
      reportId: report ? String(report._id) : null,
      scoring: scoringInfo,
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

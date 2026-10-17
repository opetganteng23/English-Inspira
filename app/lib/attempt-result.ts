import { connectDB } from "@/lib/db";
import type { AttemptHydrated, loadAttempt } from "@/lib/attempts";
import { Question } from "@/models/Question";
import { Level } from "@/models/Config";
import { User } from "@/models/User";
import { Analysis } from "@/models/Learning";
import { recommendCourses } from "@/lib/units";
import { Attempt, Test, AttemptSnapshot } from "@/models/Test";
import { Certificate } from "@/models/Itp";
import { ScoringProfile } from "@/models/Scoring";
import { equivalents } from "@/lib/score-equivalence";
import { getEquivalence } from "@/lib/clustering";
import { LEVEL_INFO } from "@/lib/level-info";
import { isLearningTopic } from "@/lib/topics";
import { buildUnanswered } from "@/lib/unanswered";
import { buildInsights } from "@/lib/insights";
import { buildSummary } from "@/lib/summary";
import { getLevels, getParam } from "@/lib/config";
import { orderQuestions } from "@/lib/shuffle";

type SnapItem = { qid: import("mongoose").Types.ObjectId; section: string; type: string; groupId?: import("mongoose").Types.ObjectId; stem: string; options: string[]; answerKey: number; explanation?: string; tags: { skill: string; topic: string }[] };

/**
 * Data hasil tes yang sudah selesai: skor, topik, analisis, level, rekomendasi. Dipakai bersama oleh halaman hasil dan ekspor PDF.
 * - TIDAK ada teks soal, opsi, kunci, penjelasan, maupun transkrip yang dikembalikan: soal tidak boleh bocor lewat laporan. `review` hanya dipakai di server untuk menghitung agregat (benar/salah/kosong per section dan jenis soal).
 * - Padanan skor hanya TOEFL ITP dan CEFR (tanpa padanan PURE/OCE).
 */
export async function attemptResult(attempt: AttemptHydrated, test: Awaited<ReturnType<typeof loadAttempt>>["test"]) {
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

    // Posisi soal menurut urutan yang benar-benar dilihat peserta (urutan acak per percobaan), dipakai untuk analisis "soal terakhir kosong" dan stamina.
    const seqOf = new Map<string, number>();
    test.sections.forEach((sec, si) => {
      const items = sec.questionIds.map((id) => byId.get(String(id))).filter((q): q is NonNullable<typeof q> => !!q);
      orderQuestions(test, items, `${String(attempt._id)}:q:${si}`).forEach((q, k) => seqOf.set(String(q._id), k + 1));
    });
    const review = ids.map((id, i) => {
      const q = byId.get(String(id));
      const a = mine.get(String(id));
      const seq = seqOf.get(String(id)) ?? i + 1;
      if (!q) return { no: i + 1, seq, firstChoice: null as number | null, section: "listening", type: "-", tags: [], groupId: null, correct: false, answered: a?.choice != null, changes: 0, timeSpentSec: a?.timeSpentSec ?? null, stem: "This question is no longer available.", options: [] as string[], yourChoice: a?.choice ?? null, answerKey: -1, explanation: "" };
      return {
        no: i + 1, seq, firstChoice: a?.firstChoice ?? null, section: q.section, type: q.type, tags: q.tags, groupId: q.groupId ? String(q.groupId) : null,
        correct: a?.choice === q.answerKey, answered: a?.choice != null, changes: a?.changes ?? 0, timeSpentSec: a?.timeSpentSec ?? null,
        stem: q.stem, options: q.options, yourChoice: a?.choice ?? null, answerKey: q.answerKey, explanation: q.explanation,
      };
    });

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
    const learning = (attempt.topicScores ?? []).filter((t) => isLearningTopic({ skill: t.skill ?? "", topic: t.topic ?? "" })); // percobaan lama masih menyimpan label internal
    const weak = learning
      .map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", score: Math.round(t.score ?? 0), correct: t.correct ?? 0, total: t.total ?? 0 }))
      .filter((t) => t.skill && t.topic && t.total >= 2 && t.score < 70).sort((x, y) => x.score - y.score).slice(0, 5);
    const recommendations = await recommendCourses(attempt.userId, u?.currentLevelId, weak);
    const eq = attempt.scoreEst != null ? equivalents(attempt.scoreEst, await getEquivalence()) : null;
    return {
      recommendations,
      previous: prev ? { name: prevTest?.name ?? "Previous test", scoreEst: prev.scoreEst, sectionScores: prev.sectionScores, topicScores: (prev.topicScores ?? []).filter((t) => isLearningTopic({ skill: t.skill ?? "", topic: t.topic ?? "" })) } : null,
      reportId: report ? String(report._id) : null,
      scoring: scoringInfo,
      levelUp: calc?.levelUp ?? null, stuck: (calc?.stuck ?? []).map((k) => k.split("|")[1] ?? k),
      kind: attempt.kind, testName: test.name, finishedAt: attempt.finishedAt,
      durationSec: attempt.finishedAt ? Math.round((+attempt.finishedAt - +attempt.startedAt) / 1000) : null,
      scoreRaw: attempt.scoreRaw, scoreEst: attempt.scoreEst, sectionScores: attempt.sectionScores, topicScores: learning,
      flags: attempt.proctorFlags.length, attemptId: String(attempt._id), analysis: attempt.aiAnalysis ?? { status: "pending" },
      level: level ? { name: level.name, quota: level.coachingQuota, scoreMin: level.scoreMin, scoreMax: level.scoreMax, info: LEVEL_INFO[String(level.key)] ?? null } : null,
      equivalents: eq ? { itp: eq.itp, cefr: eq.cefr, cefrLabel: eq.cefrLabel } : null,
      unanswered: buildUnanswered(review),
      insights: buildInsights(review),
      summary: buildSummary({
        scoreEst: attempt.scoreEst ?? null,
        sections: (attempt.sectionScores ?? []).map((x) => ({ section: x.section ?? "", scaled: x.scaled ?? 0 })),
        review, levels: (await getLevels()).map((l) => ({ name: l.name, order: l.order, scoreMin: l.scoreMin, scoreMax: l.scoreMax })), th: await getParam("weakness"),
        topics: learning.map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", correct: t.correct ?? 0, total: t.total ?? 0, score: t.score ?? 0 })),
        durationSec: attempt.finishedAt ? Math.round((+attempt.finishedAt - +attempt.startedAt) / 1000) : null,
        allottedSec: test.sections.reduce((a, x) => a + (x.durationSec ?? 0), 0), hasPrevious: !!prev,
      }),
    };
}

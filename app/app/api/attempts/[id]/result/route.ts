import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { Question } from "@/models/Question";

const FREE_EXPLANATIONS = 5; // free trial: 5 pembahasan gratis (layar 05)

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "Tes belum selesai");
    await connectDB();

    const ids = test.sections.flatMap((s) => s.questionIds);
    const qs = await Question.find({ _id: { $in: ids } }).select("section type stem options answerKey explanation tags").lean();
    const byId = new Map(qs.map((q) => [String(q._id), q]));
    const mine = new Map(attempt.answers.map((a) => [String(a.qid), a]));

    const limit = attempt.kind === "trial" && user.role !== "admin" ? FREE_EXPLANATIONS : Infinity;
    let shown = 0;
    const review = ids.map((id, i) => {
      const q = byId.get(String(id))!;
      const a = mine.get(String(id));
      const correct = a?.choice === q.answerKey;
      // Pembahasan dibuka untuk soal salah dulu, sampai batas gratis.
      const unlocked = !correct && shown < limit ? (shown++, true) : limit === Infinity;
      return {
        no: i + 1, section: q.section, type: q.type, correct, answered: a?.choice != null,
        ...(unlocked && { stem: q.stem, options: q.options, yourChoice: a?.choice ?? null, answerKey: q.answerKey, explanation: q.explanation }),
        locked: !unlocked,
      };
    });

    return NextResponse.json({
      kind: attempt.kind, testName: test.name, finishedAt: attempt.finishedAt,
      durationSec: attempt.finishedAt ? Math.round((+attempt.finishedAt - +attempt.startedAt) / 1000) : null,
      scoreRaw: attempt.scoreRaw, scoreEst: attempt.scoreEst, sectionScores: attempt.sectionScores,
      flags: attempt.proctorFlags.length,
      // Trial memberi rentang +-, bukan angka tunggal, karena tes mini hanya estimasi kasar.
      scoreRange: attempt.kind === "trial" && attempt.scoreEst ? [Math.max(310, attempt.scoreEst - 15), Math.min(677, attempt.scoreEst + 15)] : null,
      review,
    });
  } catch (e) {
    return handleError(e);
  }
}

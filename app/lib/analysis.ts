import { connectDB } from "./db";
import { generateAnalysis, type AnalysisInput, type CounselorContext } from "./ai";
import { Attempt, Test } from "@/models/Test";
import { Question } from "@/models/Question";
import { User } from "@/models/User";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import { CounselorThread } from "@/models/Counselor";
import type { Types } from "mongoose";

/** Susun data ringkas untuk analisis: skor per section, tipe soal yang paling sering salah, waktu, dan soal kosong. */
export async function buildAnalysisInput(attemptId: Types.ObjectId | string): Promise<AnalysisInput | null> {
  await connectDB();
  const attempt = await Attempt.findById(attemptId).lean();
  if (!attempt || attempt.status !== "submitted") return null;
  const [test, user] = await Promise.all([Test.findById(attempt.testId).lean(), User.findById(attempt.userId).select("targetScore").lean()]);
  if (!test) return null;
  const ids = test.sections.flatMap((s) => s.questionIds);
  const qs = await Question.find({ _id: { $in: ids } }).select("section type answerKey").lean();
  const byId = new Map(qs.map((q) => [String(q._id), q]));
  const ans = new Map(attempt.answers.map((a) => [String(a.qid), a]));

  const types = new Map<string, { section: string; type: string; wrong: number; total: number }>();
  const sections = test.sections.map((s) => {
    const sc = attempt.sectionScores.find((x) => x.section === s.name);
    let unanswered = 0, timeSum = 0, timeN = 0;
    for (const id of s.questionIds) {
      const q = byId.get(String(id)); const a = ans.get(String(id));
      if (!q) continue;
      const key = `${s.name}|${q.type}`;
      const t = types.get(key) ?? { section: s.name, type: q.type, wrong: 0, total: 0 };
      t.total++;
      if (a?.choice == null) unanswered++;
      if (a?.choice !== q.answerKey) t.wrong++;
      types.set(key, t);
      if (a?.timeSpentSec) { timeSum += a.timeSpentSec; timeN++; }
    }
    return { section: s.name, raw: sc?.raw ?? 0, total: sc?.total ?? s.questionIds.length, scaled: sc?.scaled ?? 0, avgSecPerQuestion: timeN ? timeSum / timeN : null, unanswered };
  });
  return {
    testName: test.name, kind: attempt.kind ?? test.kind, targetScore: user?.targetScore ?? null, scoreEst: attempt.scoreEst ?? 0, sections,
    weakTypes: Array.from(types.values()).filter((t) => t.wrong > 0).sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong).slice(0, 5),
  };
}

/** Jalankan analisis (dipanggil async setelah submit). Hasil disimpan di attempt.aiAnalysis. */
export async function runAnalysis(attemptId: Types.ObjectId | string) {
  await connectDB();
  // Klaim atomik: hanya satu proses yang menganalisis; hindari panggilan AI ganda.
  const claimed = await Attempt.findOneAndUpdate(
    { _id: attemptId, "aiAnalysis.status": { $nin: ["pending", "ready"] } },
    { aiAnalysis: { status: "pending", startedAt: new Date() } }
  );
  if (!claimed) return;
  try {
    const input = await buildAnalysisInput(attemptId);
    if (!input) throw new Error("Data analisis tidak lengkap");
    const { analysis, mock } = await generateAnalysis(input);
    await Attempt.updateOne({ _id: attemptId }, { aiAnalysis: { status: "ready", ...analysis, mock, generatedAt: new Date() } });
  } catch (e) {
    console.error("[analysis] gagal", e);
    await Attempt.updateOne({ _id: attemptId }, { aiAnalysis: { status: "failed", error: "Analisis belum tersedia. Coba lagi." } });
  }
}

export async function retryAnalysis(attemptId: Types.ObjectId | string) {
  await Attempt.updateOne({ _id: attemptId, "aiAnalysis.status": "failed" }, { $unset: { aiAnalysis: 1 } });
  void runAnalysis(attemptId);
}

/** Profil + riwayat untuk system prompt Konselor. */
export async function buildCounselorContext(userId: Types.ObjectId | string): Promise<CounselorContext> {
  await connectDB();
  const [user, attempts, threads, reg] = await Promise.all([
    User.findById(userId).select("name targetScore goal").lean(),
    Attempt.find({ userId, status: "submitted" }).sort({ finishedAt: -1 }).limit(5).lean(),
    CounselorThread.find({ userId }).select("actionPlan").lean(),
    ItpRegistration.findOne({ userId, status: { $in: ["submitted", "confirmed"] } }).sort({ createdAt: -1 }).lean(),
  ]);
  const session = reg ? await ItpSession.findById(reg.sessionId).select("date").lean() : null;
  const latestWithAnalysis = attempts.find((a) => (a.aiAnalysis as { status?: string } | undefined)?.status === "ready");
  const weak = ((latestWithAnalysis?.aiAnalysis as { weaknesses?: { title: string }[] } | undefined)?.weaknesses ?? []).map((w) => w.title);
  return {
    name: user?.name ?? null, targetScore: user?.targetScore ?? null, goal: user?.goal ?? null, examDate: session?.date ? session.date.toISOString().slice(0, 10) : null,
    attempts: attempts.map((a) => ({ kind: a.kind ?? "", date: (a.finishedAt ?? a.startedAt).toISOString().slice(0, 10), scoreEst: a.scoreEst ?? 0, sections: a.sectionScores.map((s) => ({ section: s.section ?? "", scaled: s.scaled ?? 0 })) })),
    weaknesses: weak,
    openPlan: threads.flatMap((t) => t.actionPlan.filter((p) => !p.done).map((p) => p.text ?? "")).slice(0, 10),
  };
}

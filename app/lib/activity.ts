import { isValidObjectId } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { orderQuestions } from "./shuffle";
import { Attempt, AttemptSnapshot, Test } from "@/models/Test";
import { Question } from "@/models/Question";

export type ActivityQuestion = { no: number; qid: string; type: string; topic: string; timeSec: number; changes: number; answered: boolean; correct: boolean | null; guess: boolean; flagged: boolean; events: number };
export type ActivityEvent = { kind: string; at: Date; minute: number; section: number | null; no: number | null };

/** Tebakan: dijawab sangat cepat (di bawah 5 detik) dan salah. Sama dengan ambang di laporan peserta. */
export const GUESS_SEC = 5;

/**
 * Timeline aktivitas satu percobaan untuk proctoring: per soal (dalam urutan tampil ke peserta) waktu yang dihabiskan,
 * ganti jawaban, benar/salah, tebakan; plus kejadian pindah tab / keluar layar penuh / paste dengan jam dan nomor soalnya.
 */
export async function buildActivity(attemptId: string) {
  if (!isValidObjectId(attemptId)) throw new HttpError(404, "Attempt not found");
  await connectDB();
  const a = await Attempt.findById(attemptId).lean();
  if (!a) throw new HttpError(404, "Attempt not found");
  const test = await Test.findById(a.testId).lean();
  if (!test) throw new HttpError(404, "Test not found");
  const snap = await AttemptSnapshot.findOne({ attemptId: a._id }).lean();
  const ids = test.sections.flatMap((s) => s.questionIds);
  const qs = snap?.items?.length
    ? snap.items.map((x) => ({ _id: x.qid, groupId: x.groupId, tags: x.tags, type: x.type, answerKey: x.answerKey }))
    : (await Question.find({ _id: { $in: ids } }).select("groupId tags type answerKey").lean()).map((x) => ({ _id: x._id, groupId: x.groupId, tags: x.tags, type: x.type, answerKey: x.answerKey }));
  const byId = new Map(qs.map((q) => [String(q._id), q]));
  const ans = new Map((a.answers ?? []).map((x) => [String(x.qid), x]));
  const flagsByQ = new Map<string, number>();
  for (const f of a.proctorFlags ?? []) if (f.qid) flagsByQ.set(String(f.qid), (flagsByQ.get(String(f.qid)) ?? 0) + 1);

  const noOf = new Map<string, { section: number; no: number }>();
  const sections = test.sections.map((s, si) => {
    const list = s.questionIds.map((id) => byId.get(String(id))).filter((q): q is NonNullable<typeof q> => !!q);
    const ordered = orderQuestions(test, list as never[], `${String(a._id)}:q:${si}`) as typeof list;
    const questions: ActivityQuestion[] = ordered.map((q, i) => {
      const x = ans.get(String(q._id));
      const answered = x?.choice != null;
      const correct = answered ? x!.choice === q.answerKey : null;
      const timeSec = Math.round(x?.timeSpentSec ?? 0);
      noOf.set(String(q._id), { section: si, no: i + 1 });
      return {
        no: i + 1, qid: String(q._id), type: q.type ?? "", topic: q.tags?.[0]?.topic ?? "", timeSec, changes: x?.changes ?? 0,
        answered, correct, guess: answered && correct === false && timeSec > 0 && timeSec < GUESS_SEC, flagged: !!x?.flagged, events: flagsByQ.get(String(q._id)) ?? 0,
      };
    });
    const timed = questions.filter((q) => q.timeSec > 0);
    return {
      name: s.name, durationSec: s.durationSec, questions,
      totalSec: questions.reduce((n, q) => n + q.timeSec, 0),
      medianSec: timed.length ? [...timed].sort((x, y) => x.timeSec - y.timeSec)[Math.floor(timed.length / 2)].timeSec : 0,
    };
  });

  const start = +a.startedAt;
  const events: ActivityEvent[] = (a.proctorFlags ?? []).map((f) => {
    const loc = f.qid ? noOf.get(String(f.qid)) : undefined;
    return { kind: f.kind ?? "", at: f.at!, minute: Math.max(0, Math.floor((+f.at! - start) / 60000)), section: loc?.section ?? (typeof f.section === "number" ? f.section : null), no: loc?.no ?? null };
  }).sort((x, y) => +x.at - +y.at);

  const all = sections.flatMap((s, si) => s.questions.map((q) => ({ ...q, section: si, sectionName: s.name })));
  const count = (k: string) => events.filter((e) => e.kind === k).length;
  return {
    attempt: { id: String(a._id), userId: String(a.userId), status: a.status, startedAt: a.startedAt, finishedAt: a.finishedAt ?? null, scoreEst: a.scoreEst ?? null, review: a.proctorReview ?? null },
    test: { name: test.name, secure: !!test.secureMode },
    sections, events,
    summary: {
      tabHidden: count("tab_hidden"), fullscreenExit: count("fullscreen_exit"), paste: count("paste"),
      guesses: all.filter((q) => q.guess).length, changed: all.filter((q) => q.changes > 0).length, unanswered: all.filter((q) => !q.answered).length,
      slowest: [...all].sort((x, y) => y.timeSec - x.timeSec).slice(0, 5).filter((q) => q.timeSec > 0).map((q) => ({ section: q.sectionName, no: q.no, timeSec: q.timeSec, correct: q.correct })),
      minutes: a.finishedAt ? Math.round((+a.finishedAt - start) / 60000) : null,
    },
  };
}

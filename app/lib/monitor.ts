import { Types } from "mongoose";
import { connectDB } from "./db";
import { buildActivity } from "./activity";
import { Attempt, Test } from "@/models/Test";
import { TestSeat, TestSession } from "@/models/Schedule";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

/** Status sambungan peserta yang sedang tes, dari kabar terakhir (heartbeat 30 detik). */
export type Live = "active" | "unstable" | "offline";
export const liveOf = (lastSeen: Date | null | undefined, now = Date.now()): Live => {
  if (!lastSeen) return "offline";
  const age = now - +lastSeen;
  return age <= 75_000 ? "active" : age <= 180_000 ? "unstable" : "offline";
};

export type Issue = { code: string; label: string; level: "bad" | "warn" | "info" };
export type MonitorRow = {
  id: string; name: string; email: string; institution: string; session: string;
  status: "in_progress" | "submitted"; startedAt: string; finishedAt: string | null; minutes: number | null;
  section: number; sectionName: string; sections: number; answered: number; total: number;
  score: number | null; lastSeen: string | null; live: Live | null;
  tab: number; fullscreen: number; paste: number; lost: number; gaps: number; gapMaxMin: number; loads: number;
  issues: Issue[]; risk: number; review: string | null; reviewNote: string | null;
};

const SEC: Record<string, string> = { listening: "Listening", structure: "Structure", reading: "Reading" };
/** Sejak saat ini ruang tes mencatat soal yang sengaja dilewati; sebelumnya "kosong terselip" bisa berarti dilewati atau hilang. */
export const SKIP_TRACKED_SINCE = new Date("2026-10-21T14:15:00Z");

/**
 * Baris tabel Monitoring & Proctoring untuk satu tes: semua percobaan (sedang berjalan dan selesai),
 * dengan masalah yang terdeteksi otomatis dan skor risiko untuk mengurutkan antrian peninjauan.
 */
export async function monitorRows(testId: string, now = new Date(), opts: { institutionId?: string; releasedOnly?: boolean } = {}) {
  await connectDB();
  const test = await Test.findById(testId).select("name sections secureMode").lean();
  if (!test) return null;
  const total = test.sections.reduce((n, s) => n + s.questionIds.length, 0);
  const limitMin = test.sections.reduce((n, s) => n + (s.durationSec ?? 0), 0) / 60;
  const list = await Attempt.aggregate<{
    _id: Types.ObjectId; userId: Types.ObjectId; status: string; startedAt: Date; finishedAt?: Date; updatedAt: Date; sectionIdx: number; scoreEst?: number;
    releaseAt?: Date; flags: { kind: string }[]; integrity?: { isolatedBlanks?: number }; conn?: { lastSeenAt?: Date; loads?: number; gaps?: { from: Date; to: Date }[] }; proctorReview?: { status?: string; note?: string }; answered: number;
  }>([
    { $match: { testId: new Types.ObjectId(testId), status: { $in: ["in_progress", "submitted"] }, ...(opts.institutionId ? { userId: { $in: await User.distinct("_id", { institutionId: new Types.ObjectId(opts.institutionId) }) } } : {}) } },
    { $project: { userId: 1, releaseAt: 1, status: 1, startedAt: 1, finishedAt: 1, updatedAt: 1, sectionIdx: 1, scoreEst: 1, flags: "$proctorFlags", integrity: 1, conn: 1, proctorReview: 1, answered: { $size: { $filter: { input: { $ifNull: ["$answers", []] }, cond: { $gt: ["$$this.choice", null] } } } } } },
  ]);
  // satu baris per peserta: percobaan terbaru
  const latest = new Map<string, (typeof list)[number]>();
  for (const a of list) { const k = String(a.userId), cur = latest.get(k); if (!cur || +a.startedAt > +cur.startedAt) latest.set(k, a); }
  const attempts = [...latest.values()];
  const uids = attempts.map((a) => a.userId);
  const [users, seats] = await Promise.all([
    User.find({ _id: { $in: uids }, qaTester: { $ne: true } }).select("name email institutionId").lean(),
    TestSeat.find({ testId, userId: { $in: uids } }).select("userId sessionId").lean(),
  ]);
  const sessions = new Map((await TestSession.find({ testId }).select("label").lean()).map((s) => [String(s._id), s.label]));
  const insts = new Map((await Institution.find({ _id: { $in: users.map((u) => u.institutionId).filter((x): x is Types.ObjectId => !!x) } }).select("name").lean()).map((i) => [String(i._id), i.name]));
  const um = new Map(users.map((u) => [String(u._id), u])), sm = new Map(seats.map((s) => [String(s.userId), sessions.get(String(s.sessionId)) ?? ""]));

  const rows: MonitorRow[] = [];
  for (const a of attempts) {
    const u = um.get(String(a.userId));
    if (!u) continue; // akun QA tidak ditampilkan
    const count = (k: string) => (a.flags ?? []).filter((f) => f.kind === k).length;
    const tab = count("tab_hidden"), fullscreen = count("fullscreen_exit"), paste = count("paste");
    const gaps = a.conn?.gaps ?? [], gapMaxMin = gaps.length ? Math.round(Math.max(...gaps.map((g) => +g.to - +g.from)) / 60000) : 0;
    const lost = a.integrity?.isolatedBlanks ?? 0, loads = a.conn?.loads ?? 0;
    const done = a.status === "submitted";
    const minutes = done && a.finishedAt ? Math.round((+a.finishedAt - +a.startedAt) / 60000) : null;
    const lastSeen = a.conn?.lastSeenAt ?? (done ? null : a.updatedAt);
    const live = done ? null : liveOf(lastSeen, +now);
    const blanks = done ? total - a.answered : 0;
    const issues: Issue[] = [];
    if (live === "offline") issues.push({ code: "offline", label: "Disconnected now", level: "bad" });
    else if (live === "unstable") issues.push({ code: "unstable", label: "Unstable connection", level: "warn" });
    const sure = +a.startedAt >= +SKIP_TRACKED_SINCE;
    if (lost) issues.push(sure ? { code: "lost", label: `Possible lost answers ×${lost}`, level: "bad" } : { code: "lost", label: `Skipped or lost ×${lost}`, level: "warn" });
    if (gaps.length) issues.push({ code: "gap", label: `Disconnected ${gaps.length}× (max ${gapMaxMin}m)`, level: gapMaxMin >= 3 ? "warn" : "info" });
    if (blanks >= 10) issues.push({ code: "blank", label: `${blanks} blank`, level: "warn" });
    if (minutes != null && limitMin && minutes < limitMin * 0.5) issues.push({ code: "fast", label: `Finished fast (${minutes}m)`, level: "warn" });
    if (tab) issues.push({ code: "tab", label: `Tab switch ×${tab}`, level: tab >= 10 ? "bad" : "warn" });
    if (fullscreen) issues.push({ code: "fullscreen", label: `Left fullscreen ×${fullscreen}`, level: "warn" });
    if (paste) issues.push({ code: "paste", label: `Paste ×${paste}`, level: "bad" });
    if (loads > 2) issues.push({ code: "reload", label: `Reopened ×${loads - 1}`, level: "info" });
    const risk = Math.min(100, (sure ? lost * 25 : Math.min(20, lost * 5)) + (live === "offline" ? 25 : live === "unstable" ? 10 : 0) + Math.min(30, tab * 2) + Math.min(10, fullscreen * 2) + paste * 15 + (gapMaxMin >= 3 ? 10 : gaps.length ? 4 : 0) + (blanks >= 10 ? 10 : 0) + (issues.some((i) => i.code === "fast") ? 20 : 0) + (loads > 2 ? 3 : 0));
    rows.push({
      id: String(a._id), name: u.name ?? "", email: u.email, institution: u.institutionId ? insts.get(String(u.institutionId)) ?? "" : "", session: sm.get(String(a.userId)) ?? "",
      status: done ? "submitted" : "in_progress", startedAt: a.startedAt.toISOString(), finishedAt: a.finishedAt?.toISOString() ?? null, minutes,
      section: a.sectionIdx ?? 0, sectionName: SEC[test.sections[a.sectionIdx ?? 0]?.name] ?? test.sections[a.sectionIdx ?? 0]?.name ?? "", sections: test.sections.length,
      answered: a.answered, total, score: done && !(opts.releasedOnly && a.releaseAt && +a.releaseAt > +now) ? a.scoreEst ?? null : null, lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null, live,
      tab, fullscreen, paste, lost, gaps: gaps.length, gapMaxMin, loads, issues, risk,
      review: a.proctorReview?.status ?? null, reviewNote: a.proctorReview?.note ?? null,
    });
  }
  return { test: { id: String(test._id), name: test.name, secure: !!test.secureMode, total, limitMin: Math.round(limitMin) }, rows, at: now.toISOString() };
}

export type Finding = { level: "bad" | "warn" | "info" | "ok"; title: string; detail: string };
const clock = (d: Date) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Diagnosis otomatis satu percobaan dalam kalimat biasa: koneksi, jawaban hilang, kehabisan waktu, kecepatan, dan aktivitas di luar layar. */
export async function diagnose(attemptId: string) {
  const act = await buildActivity(attemptId);
  const a = await Attempt.findById(attemptId).select("conn integrity sectionIdx startedAt").lean();
  const f: Finding[] = [];
  const gaps = a?.conn?.gaps ?? [];
  const lostWhere = a?.integrity?.where ?? [];
  for (const g of gaps) {
    const min = Math.max(1, Math.round((+g.to! - +g.from!) / 60000));
    const sec = act.sections[g.section ?? 0]?.name ?? "";
    f.push({ level: min >= 3 ? "warn" : "info", title: `Connection lost for ${min} min`, detail: `${clock(g.from!)}–${clock(g.to!)} WIB during ${SEC[sec] ?? sec}. The test resumed afterwards${lostWhere.length ? "" : "; no answers were lost"}.` });
  }
  if ((a?.conn?.loads ?? 0) > 2) f.push({ level: "info", title: `Test page opened ${a!.conn!.loads} times`, detail: "The participant reloaded or reopened the test (browser closed, device restarted, or network change)." });
  if (a?.integrity?.isolatedBlanks) {
    const sure = a.startedAt && +a.startedAt >= +SKIP_TRACKED_SINCE;
    f.push(sure
      ? { level: "bad", title: `${a.integrity.isolatedBlanks} possible lost answer(s)`, detail: `Blank questions between answered ones with no saved data in ${lostWhere.join(", ")}. Skipped questions are recorded separately, so these answers most likely did not reach the server.` }
      : { level: "warn", title: `${a.integrity.isolatedBlanks} blank question(s) between answers`, detail: `In ${lostWhere.join(", ")}. This test started before skipped questions were recorded, so each one was either skipped on purpose (Next without choosing) or an answer that did not reach the server.` });
  }
  act.sections.forEach((s, si) => {
    const q = s.questions, blank = q.filter((x) => !x.answered).length;
    if (!q.length || (act.attempt.status !== "submitted" && si >= (a?.sectionIdx ?? 0))) return;
    let trailing = 0; for (let i = q.length - 1; i >= 0 && !q[i].answered; i--) trailing++;
    const name = SEC[s.name] ?? s.name, used = s.durationSec ? s.totalSec / s.durationSec : 0;
    if (trailing >= 3 && used >= 0.85) f.push({ level: "warn", title: `Ran out of time in ${name}`, detail: `The last ${trailing} questions were left blank after using ${Math.round(used * 100)}% of the ${Math.round(s.durationSec / 60)}-minute limit.` });
    else if (trailing >= 3) f.push({ level: "warn", title: `${trailing} questions left blank at the end of ${name}`, detail: `Only ${Math.round(used * 100)}% of the time was spent on questions, so time was still available.` });
    if (blank - trailing >= 3 && !a?.integrity?.isolatedBlanks) f.push({ level: "info", title: `${blank - trailing} questions skipped in ${name}`, detail: "Skipped questions in the middle of the section (the participant pressed Next without answering)." });
  });
  const sm = act.summary;
  if (sm.minutes != null) {
    const limit = act.sections.reduce((n, s) => n + s.durationSec, 0) / 60;
    if (sm.minutes < limit * 0.5) f.push({ level: "warn", title: `Finished fast: ${sm.minutes} of ${Math.round(limit)} minutes`, detail: `${sm.guesses} likely guesses (answered in under 5 seconds and wrong). The result may not reflect real ability.` });
  }
  if (sm.guesses >= 10 && !f.some((x) => x.title.startsWith("Finished fast"))) f.push({ level: "warn", title: `${sm.guesses} likely guesses`, detail: "Answered in under 5 seconds and wrong." });
  if (sm.tabHidden) f.push({ level: sm.tabHidden >= 10 ? "bad" : "warn", title: `Switched tab or app ${sm.tabHidden}×`, detail: "Recorded with the question on screen; see the activity timeline. Not proof of cheating on its own (notifications or device issues can cause it)." });
  if (sm.fullscreenExit) f.push({ level: "warn", title: `Left fullscreen ${sm.fullscreenExit}×`, detail: "Recorded with the question on screen." });
  if (sm.paste) f.push({ level: "bad", title: `Pasted text ${sm.paste}×`, detail: "Paste is unusual in a multiple-choice test." });
  if (!f.length) f.push({ level: "ok", title: "No problems found", detail: "Connection, answers and activity look normal." });
  const order = { bad: 0, warn: 1, info: 2, ok: 3 } as const;
  f.sort((x, y) => order[x.level] - order[y.level]);
  return {
    findings: f,
    sections: act.sections.map((s) => ({ name: SEC[s.name] ?? s.name, answered: s.questions.filter((q) => q.answered).length, total: s.questions.length, correct: s.questions.filter((q) => q.correct).length, minutes: Math.round(s.totalSec / 60), limit: Math.round(s.durationSec / 60) })),
    gaps: gaps.map((g) => ({ from: g.from, to: g.to, section: g.section ?? 0 })),
    loads: a?.conn?.loads ?? 0,
    summary: sm, attempt: act.attempt, test: act.test,
  };
}

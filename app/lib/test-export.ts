import { Types } from "mongoose";
import ExcelJS from "exceljs";
import { connectDB } from "./db";
import { getLevels, levelForScore } from "./config";
import { cefrForItp } from "./score-equivalence";
import { effectiveWindow, windowState } from "./schedule";
import { Test, Attempt } from "@/models/Test";
import { TestSession, TestSeat } from "@/models/Schedule";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { ageOf, ageGroupOf } from "./age";
import { scheduleChanges } from "./schedule-changes";

/** Kehadiran dari status: hadir bila sudah mulai, tidak hadir bila sesi lewat tanpa mulai. */
export function attendanceOf(s: ExportStatus) {
  return s === "Finished" || s === "In progress" ? "Present" : s === "Missed" ? "Absent" : s === "Not started (open now)" ? "Open now" : s === "Not started (opens later)" ? "Upcoming" : "-";
}

export type ExportStatus = "Finished" | "In progress" | "Not started (open now)" | "Not started (opens later)" | "Missed" | "Not scheduled";

/** Status satu peserta untuk satu tes, dari percobaan terakhir dan jendela jadwalnya. Murni (mudah diuji). */
export function rowStatus(attempt: { status: string } | null, window: { opensAt: Date; closesAt: Date } | null, now = new Date()): ExportStatus {
  if (attempt?.status === "submitted") return "Finished";
  if (attempt?.status === "in_progress") return "In progress";
  if (!window) return "Not scheduled";
  const st = windowState(window, now);
  return st === "open" ? "Not started (open now)" : st === "upcoming" ? "Not started (opens later)" : "Missed";
}

const WIB = (d?: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "");
const DAY = (d: Date) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/**
 * Hasil satu tes untuk admin: semua peserta yang dijadwalkan (dan yang mengerjakan tanpa jadwal), satu baris per orang.
 * Skor, bagian, CEFR, level, waktu, catatan proctoring, plus rekap per tanggal dan per level.
 */
/** Cakupan laporan: satu institusi, satu cabang, satu kelompok umur; releasedOnly menyembunyikan skor yang belum dirilis (admin institusi). */
export type ReportScope = { institutionId?: string; branch?: string; province?: string; age?: string; releasedOnly?: boolean; from?: string; to?: string };
/** Tanggal tes (WIB, YYYY-MM-DD) satu baris: hari mulai mengerjakan; bila belum mulai, hari jadwalnya. */
const testDay = (startedAt: Date | null | undefined, sortMs: number) => {
  const d = startedAt ? new Date(startedAt) : sortMs < Number.MAX_SAFE_INTEGER ? new Date(sortMs) : null;
  return d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) : null;
};
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
/** Ambil from/to/branch/age dari query string (diabaikan bila formatnya salah). */
export function scopeFromQuery(q: URLSearchParams): Pick<ReportScope, "from" | "to" | "branch" | "province" | "age"> {
  const day = (k: string) => { const v = q.get(k); return v && DAY_RX.test(v) ? v : undefined; };
  return { from: day("from"), to: day("to"), branch: q.get("branch") || undefined, province: q.get("province") || undefined, age: q.get("age") || undefined };
}

type AttemptRow = {
  _id: Types.ObjectId; userId: Types.ObjectId; status: string; scoreEst?: number | null; sectionScores?: { section: string; scaled?: number | null }[];
  startedAt?: Date; finishedAt?: Date; releaseAt?: Date; scoreBasis?: string; proctorReview?: { status?: string }; answered: number;
  topicScores?: { skill?: string; topic?: string; correct?: number; total?: number }[];
};

export async function collectTestRows(testId: string, now = new Date(), sessionId?: string, scope: ReportScope = {}) {
  await connectDB();
  const test = await Test.findById(testId).lean();
  if (!test) return null;
  const [sessions, seats, attempts, levels] = await Promise.all([
    TestSession.find({ testId, ...(sessionId ? { _id: sessionId } : {}) }).sort({ opensAt: 1 }).lean(),
    TestSeat.find({ testId, ...(sessionId ? { sessionId } : {}) }).lean(),
    // Hanya kolom yang dipakai laporan. Dulu seluruh dokumen (jawaban, catatan proctoring, koneksi, audio) dimuat untuk ribuan
    // percobaan sehingga memori melewati batas PM2 dan aplikasi dimatikan paksa (502 di Analytics, peserta tes ikut terputus).
    Attempt.aggregate<AttemptRow>([
      { $match: { testId: new Types.ObjectId(String(testId)) } },
      { $sort: { startedAt: 1 } },
      { $project: {
        userId: 1, status: 1, scoreEst: 1, sectionScores: 1, startedAt: 1, finishedAt: 1, releaseAt: 1, scoreBasis: 1, "proctorReview.status": 1, topicScores: 1,
        answered: { $size: { $filter: { input: { $ifNull: ["$answers", []] }, as: "x", cond: { $ne: [{ $ifNull: ["$$x.choice", null] }, null] } } } },
        ...Object.fromEntries(["tab_hidden", "fullscreen_exit", "paste"].map((k) => [`flag_${k}`, { $size: { $filter: { input: { $ifNull: ["$proctorFlags", []] }, as: "f", cond: { $eq: ["$$f.kind", k] } } } }])),
      } },
    ]).allowDiskUse(true),
    getLevels(),
  ]);
  const sessById = new Map(sessions.map((s) => [String(s._id), s]));
  // percobaan yang dipakai: selesai terakhir; bila belum ada, yang sedang berjalan
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    const k = String(a.userId), cur = latest.get(k);
    if (!cur || a.status === "submitted" || cur.status !== "submitted") latest.set(k, a);
  }
  if (sessionId && !sessions.length) return null;
  // Ekspor satu sesi: hanya peserta sesi itu (percobaan orang lain tidak ikut).
  const userIds = sessionId ? [...new Set(seats.map((s) => String(s.userId)))] : [...new Set([...seats.map((s) => String(s.userId)), ...latest.keys()])];
  const users = await User.find({ _id: { $in: userIds } }).select("name email phone institutionId qaTester role status lastLoginAt branch city province birthDate").lean();
  const insts = new Map((await Institution.find({ _id: { $in: users.map((u) => u.institutionId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name").lean()).map((i) => [String(i._id), i.name]));
  const seatBy = new Map(seats.map((s) => [String(s.userId), s]));

  const rows = users.map((u) => {
    const id = String(u._id), seat = seatBy.get(id), sess = seat ? sessById.get(String(seat.sessionId)) : undefined;
    const win = sess ? effectiveWindow({ opensAt: sess.opensAt, closesAt: sess.closesAt }, seat?.override) : null;
    const a = latest.get(id) ?? null;
    const done = a?.status === "submitted" && typeof a.scoreEst === "number";
    const sec = (n: string) => a?.sectionScores?.find((s) => s.section === n)?.scaled ?? null;
    const flags = (k: string) => (a ? (a as unknown as Record<string, number>)[`flag_${k}`] ?? 0 : 0);
    const lvl = done ? levelForScore(levels, a!.scoreEst!)?.name ?? "" : "";
    return {
      name: u.name ?? "", email: u.email, institution: u.institutionId ? insts.get(String(u.institutionId)) ?? "" : "",
      qa: u.qaTester ? "QA" : "",
      session: sess?.label ?? "", scheduledDay: win ? DAY(win.opensAt) : "", window: win ? `${WIB(win.opensAt)} - ${WIB(win.closesAt)}` : "",
      extended: seat?.override?.at ? `Yes: ${seat.override.reason ?? ""}` : "",
      status: rowStatus(a, win, now),
      attendance: attendanceOf(rowStatus(a, win, now)),
      account: u.status === "active" ? "Active" : u.status === "invited" ? "Awaiting activation" : u.status === "disabled" ? "Inactive" : String(u.status ?? ""),
      invitedAt: seat?.invitedAt ? WIB(seat.invitedAt) : seat ? "Not sent" : "",
      lastLogin: u.lastLoginAt ? WIB(u.lastLoginAt) : "Never",
      score: done ? a!.scoreEst! : null, cefr: done ? cefrForItp(a!.scoreEst!) : "", level: lvl,
      listening: done ? sec("listening") : null, structure: done ? sec("structure") : null, reading: done ? sec("reading") : null,
      answered: a ? a.answered : null,
      started: WIB(a?.startedAt), finished: WIB(a?.finishedAt),
      minutes: a?.startedAt && a?.finishedAt ? Math.round((+a.finishedAt - +a.startedAt) / 60000) : null,
      released: a?.releaseAt ? (now >= a.releaseAt ? "Released" : `At ${WIB(a.releaseAt)}`) : a ? "Immediately" : "",
      basis: a?.scoreBasis ?? "",
      tabHidden: a ? flags("tab_hidden") : null, fullscreenExit: a ? flags("fullscreen_exit") : null, paste: a ? flags("paste") : null,
      review: a?.proctorReview?.status ?? "",
      startedAt: a?.startedAt ?? null,
      userId: id,
      instId: u.institutionId ? String(u.institutionId) : "", branch: u.branch ?? "", province: u.province ?? "", birthDate: u.birthDate ?? null, ageGroup: ageGroupOf(ageOf(u.birthDate))?.label ?? "", age: ageOf(u.birthDate), phone: u.phone ?? "", city: u.city ?? "",
      topics: done ? (a!.topicScores ?? []).map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", correct: t.correct ?? 0, total: t.total ?? 0 })) : [],
      _sort: win ? +win.opensAt : Number.MAX_SAFE_INTEGER,
    };
  }).sort((x, y) => x._sort - y._sort || x.name.localeCompare(y.name))
    .filter((r) => (!scope.institutionId || r.instId === scope.institutionId) && (!scope.branch || r.branch === scope.branch) && (!scope.province || r.province === scope.province) && (!scope.age || ageGroupOf(ageOf(r.birthDate))?.key === scope.age))
    .filter((r) => { if (!scope.from && !scope.to) return true; const d = testDay(r.startedAt, r._sort); return !!d && (!scope.from || d >= scope.from) && (!scope.to || d <= scope.to); })
    .map((r) => (scope.releasedOnly && r.status === "Finished" && r.released.startsWith("At") ? { ...r, score: null, cefr: "", level: "", listening: null, structure: null, reading: null, topics: [], released: "Held" } : r));

  return { test, sessions, rows, levels };
}

export async function buildTestExport(testId: string, now = new Date(), sessionId?: string, scope: ReportScope = {}) {
  const got = await collectTestRows(testId, now, sessionId, scope);
  if (!got) return null;
  const { test, sessions, rows, levels } = got;
  const wb = new ExcelJS.Workbook();
  wb.creator = "English Inspira AI";
  const NAVY = "FF0A2257";
  const head = (ws: ExcelJS.Worksheet) => { const r = ws.getRow(1); r.font = { bold: true, color: { argb: "FFFFFFFF" } }; r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; r.alignment = { vertical: "middle", wrapText: true }; r.height = 30; ws.views = [{ state: "frozen", ySplit: 1 }]; };

  // ---- Ringkasan
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Item", key: "k", width: 44 }, { header: "Value", key: "v", width: 40 }];
  const fin = rows.filter((r) => r.status === "Finished");
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => typeof x === "number"); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : "-"; };
  [
    ["Test", test.name], ...(sessionId ? [["Session", sessions[0].label]] : []), ["Exported", WIB(now) + " WIB"], ["People in this report", rows.length],
    ["Present (started)", rows.filter((r) => r.attendance === "Present").length], ["Absent (session closed, not started)", rows.filter((r) => r.attendance === "Absent").length], ["Invitations sent", rows.filter((r) => r.invitedAt && r.invitedAt !== "Not sent").length], ["Never signed in", rows.filter((r) => r.lastLogin === "Never").length],
    ["Finished", fin.length], ["In progress", rows.filter((r) => r.status === "In progress").length],
    ["Not started (open now)", rows.filter((r) => r.status === "Not started (open now)").length],
    ["Not started (opens later)", rows.filter((r) => r.status === "Not started (opens later)").length],
    ["Missed (session closed, not started)", rows.filter((r) => r.status === "Missed").length],
    ["Average total score (finished)", avg(fin.map((r) => r.score))],
    ["Average Listening / Structure / Reading", `${avg(fin.map((r) => r.listening))} / ${avg(fin.map((r) => r.structure))} / ${avg(fin.map((r) => r.reading))}`],
  ].forEach(([k, v]) => sum.addRow({ k, v }));
  head(sum);

  // ---- Hasil (satu baris per orang)
  const res = wb.addWorksheet("Results");
  res.columns = [
    { header: "No", key: "no", width: 6 }, { header: "Name", key: "name", width: 30 }, { header: "Email", key: "email", width: 34 }, { header: "Institution", key: "institution", width: 24 }, { header: "Branch", key: "branch", width: 24 }, { header: "Age group", key: "ageGroup", width: 10 },
    { header: "Scheduled day", key: "scheduledDay", width: 18 }, { header: "Window (WIB)", key: "window", width: 36 }, { header: "Special schedule", key: "extended", width: 18 },
    { header: "Attendance", key: "attendance", width: 13 }, { header: "Status", key: "status", width: 22 }, { header: "Total score", key: "score", width: 11 }, { header: "CEFR", key: "cefr", width: 8 }, { header: "Level", key: "level", width: 14 },
    { header: "Listening", key: "listening", width: 10 }, { header: "Structure", key: "structure", width: 10 }, { header: "Reading", key: "reading", width: 10 },
    { header: "Answered", key: "answered", width: 10 }, { header: "Started (WIB)", key: "started", width: 20 }, { header: "Finished (WIB)", key: "finished", width: 20 }, { header: "Minutes", key: "minutes", width: 9 },
    { header: "Result release", key: "released", width: 22 }, { header: "Score basis", key: "basis", width: 12 },
    { header: "Tab hidden", key: "tabHidden", width: 10 }, { header: "Fullscreen exit", key: "fullscreenExit", width: 12 }, { header: "Paste", key: "paste", width: 8 }, { header: "Proctor review", key: "review", width: 14 }, { header: "QA account", key: "qa", width: 10 },
  ];
  rows.forEach((r, i) => res.addRow({ ...r, no: i + 1 }));
  head(res);
  res.autoFilter = { from: "A1", to: { row: 1, column: res.columns.length } };
  const STC: Record<string, string> = { Finished: "FFE6F4EC", "In progress": "FFE6EEFA", Missed: "FFFBE3E3", "Not started (open now)": "FFFBF1DB" };
  res.eachRow((row, i) => { if (i > 1) { const c = row.getCell("status"); const col = STC[String(c.value)]; if (col) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col } }; } });
  if (rows.length) res.addConditionalFormatting({ ref: `L2:L${rows.length + 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 310 }, { type: "num", value: 677 }], color: { argb: "FF0B4FA6" } } as never] });

  // ---- Kehadiran (tanpa skor: aman dibagikan ke institusi)
  const att = wb.addWorksheet("Attendance");
  att.columns = [
    { header: "No", key: "no", width: 6 }, { header: "Name", key: "name", width: 32 }, { header: "Email", key: "email", width: 34 }, { header: "Branch", key: "branch", width: 24 }, { header: "Age group", key: "ageGroup", width: 10 }, { header: "Scheduled day", key: "scheduledDay", width: 18 },
    { header: "Attendance", key: "attendance", width: 14 }, { header: "Detail", key: "status", width: 24 }, { header: "Started (WIB)", key: "started", width: 20 }, { header: "Finished (WIB)", key: "finished", width: 20 }, { header: "Minutes", key: "minutes", width: 9 },
    { header: "Account", key: "account", width: 20 }, { header: "Invitation sent (WIB)", key: "invitedAt", width: 20 }, { header: "Last sign-in (WIB)", key: "lastLogin", width: 20 }, { header: "Special schedule", key: "extended", width: 18 },
    { header: "Tab hidden", key: "tabHidden", width: 10 }, { header: "Fullscreen exit", key: "fullscreenExit", width: 12 }, { header: "QA account", key: "qa", width: 10 },
  ];
  rows.forEach((r, i) => att.addRow({ ...r, no: i + 1 }));
  head(att);
  att.autoFilter = { from: "A1", to: { row: 1, column: att.columns.length } };
  const ATC: Record<string, string> = { Present: "FFE6F4EC", Absent: "FFFBE3E3", "Open now": "FFFBF1DB" };
  att.eachRow((row, i) => { if (i > 1) { const c = row.getCell("attendance"); const col = ATC[String(c.value)]; if (col) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col } }; } });

  // ---- Rekap per tanggal (kehadiran + hasil)
  const day = wb.addWorksheet("By day");
  day.columns = [{ header: "Scheduled day", key: "d", width: 22 }, { header: "Scheduled", key: "n", width: 11 }, { header: "Invited", key: "inv", width: 9 }, { header: "Present", key: "pr", width: 9 }, { header: "Finished", key: "f", width: 10 }, { header: "In progress", key: "p", width: 12 }, { header: "Not started", key: "w", width: 12 }, { header: "Absent (missed)", key: "m", width: 14 }, { header: "% finished", key: "pct", width: 11 }, { header: "Average score", key: "avg", width: 13 }, { header: "Never signed in", key: "nl", width: 15 }];
  const days = [...new Set(rows.map((r) => r.scheduledDay || "Not scheduled"))];
  for (const d of days) {
    const rs = rows.filter((r) => (r.scheduledDay || "Not scheduled") === d), f = rs.filter((r) => r.status === "Finished");
    day.addRow({ d, n: rs.length, inv: rs.filter((r) => r.invitedAt && r.invitedAt !== "Not sent").length, pr: rs.filter((r) => r.attendance === "Present").length, nl: rs.filter((r) => r.lastLogin === "Never").length, f: f.length, p: rs.filter((r) => r.status === "In progress").length, w: rs.filter((r) => r.status.startsWith("Not started")).length, m: rs.filter((r) => r.status === "Missed").length, pct: rs.length ? f.length / rs.length : 0, avg: avg(f.map((r) => r.score)) });
  }
  day.getColumn("pct").numFmt = "0%";
  head(day);
  if (days.length) day.addConditionalFormatting({ ref: `I2:I${days.length + 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FF1D6B3F" } } as never] });

  // ---- Rekap level dan CEFR (yang selesai)
  const lv = wb.addWorksheet("By level");
  lv.columns = [{ header: "Level", key: "l", width: 18 }, { header: "Score range", key: "r", width: 14 }, { header: "People", key: "n", width: 10 }, { header: "% of finished", key: "p", width: 14 }];
  for (const l of levels) { const n = fin.filter((r) => r.level === l.name).length; lv.addRow({ l: l.name, r: `${l.scoreMin}-${l.scoreMax}`, n, p: fin.length ? n / fin.length : 0 }); }
  lv.addRow({});
  lv.addRow({ l: "CEFR", r: "", n: "People" }).font = { bold: true };
  for (const c of ["A1", "A2", "B1", "B2", "C1"]) { const n = fin.filter((r) => r.cefr === c).length; lv.addRow({ l: c, n, p: fin.length ? n / fin.length : 0 }); }
  lv.getColumn("p").numFmt = "0%";
  head(lv);
  lv.addConditionalFormatting({ ref: `D2:D${levels.length + 1}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FF0B4FA6" } } as never] });

  // ---- Rekap perubahan jadwal (pindah sesi & perpanjangan waktu)
  const sc = await scheduleChanges(testId, { sessionId, scope });
  addScheduleSheet(wb, sc?.changes ?? [], head);
  sum.addRow({ k: "Schedule changes (people / changes)", v: `${sc?.people ?? 0} / ${sc?.changes.length ?? 0}` });

  return { name: sessionId ? `${test.name} - ${sessions[0].label}` : test.name, buffer: Buffer.from(await wb.xlsx.writeBuffer()), rows: rows.length };
}

const SRC: Record<string, string> = { system: "System log", email: "Rebuilt from emails", extension: "Extension log" };
type ExcelHead = (ws: ExcelJS.Worksheet) => void;
/** Sheet "Schedule changes": satu baris per perubahan jadwal, dengan data peserta (nama, email, telepon, umur, cabang, lokasi). */
function addScheduleSheet(wb: ExcelJS.Workbook, changes: NonNullable<Awaited<ReturnType<typeof scheduleChanges>>>["changes"], head: ExcelHead) {
  const ch = wb.addWorksheet("Schedule changes");
  ch.columns = [
    { header: "No", key: "no", width: 6 }, { header: "Name", key: "name", width: 30 }, { header: "Email", key: "email", width: 34 }, { header: "Phone", key: "phone", width: 16 }, { header: "Age", key: "age", width: 7 },
    { header: "Branch", key: "branch", width: 22 }, { header: "City", key: "city", width: 18 }, { header: "Province", key: "province", width: 20 },
    { header: "Change", key: "type", width: 16 }, { header: "From", key: "from", width: 26 }, { header: "To", key: "to", width: 30 }, { header: "Changed (WIB)", key: "atText", width: 20 },
    { header: "Changed by", key: "by", width: 22 }, { header: "Reason", key: "reason", width: 30 }, { header: "Recorded from", key: "sourceText", width: 22 },
    { header: "Status now", key: "status", width: 22 }, { header: "Attendance", key: "attendance", width: 12 }, { header: "Score", key: "score", width: 9 },
  ];
  changes.forEach((c, i) => ch.addRow({ ...c, no: i + 1, atText: c.at ? WIB(c.at) : "", sourceText: SRC[c.source] ?? c.source }));
  if (!changes.length) ch.addRow({ name: "No schedule changes in this report." });
  head(ch);
  ch.autoFilter = { from: "A1", to: { row: 1, column: ch.columns.length } };
  return ch;
}

/** Excel khusus perubahan jadwal: ringkasan (per cabang, per tanggal tujuan) + daftar lengkap. Cakupan & rentang tanggal (tanggal perubahan) mengikuti laporan. */
export async function buildScheduleChangesXlsx(testId: string, sessionId?: string, scope: ReportScope = {}) {
  const sc = await scheduleChanges(testId, { sessionId, scope });
  if (!sc) return null;
  const wb = new ExcelJS.Workbook();
  wb.creator = "English Inspira AI";
  const head: ExcelHead = (ws) => { const r = ws.getRow(1); r.font = { bold: true, color: { argb: "FFFFFFFF" } }; r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2257" } }; r.alignment = { vertical: "middle", wrapText: true }; r.height = 30; ws.views = [{ state: "frozen", ySplit: 1 }]; };
  const c = sc.changes;
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Item", key: "k", width: 40 }, { header: "Value", key: "v", width: 40 }];
  const range = scope.from || scope.to ? `${scope.from ?? "start"} to ${scope.to ?? "today"} (date of change)` : "All dates";
  [["Test", sc.test.name], ["Report", "Schedule changes"], ["Changes made", range], ...(scope.branch ? [["Branch", scope.branch]] : []), ...(scope.province ? [["Province", scope.province]] : []), ...(scope.age ? [["Age group", scope.age]] : []),
    ["Exported", WIB(new Date()) + " WIB"], ["People", sc.people], ["Changes", c.length], ["Moved to another session", c.filter((x) => x.type === "Moved").length], ["Extended window", c.filter((x) => x.type === "Extended window").length],
    ["Finished the test after the change", new Set(c.filter((x) => x.status === "Finished").map((x) => x.userId)).size], ["Absent at the new schedule", new Set(c.filter((x) => x.attendance === "Absent").map((x) => x.userId)).size],
  ].forEach(([k, v]) => sum.addRow({ k, v }));
  head(sum);
  const tally = (key: (x: (typeof c)[number]) => string) => { const m = new Map<string, number>(); for (const x of c) m.set(key(x), (m.get(key(x)) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const br = wb.addWorksheet("By branch");
  br.columns = [{ header: "Branch", key: "b", width: 30 }, { header: "Changes", key: "n", width: 12 }];
  tally((x) => x.branch || "No personnel data").forEach(([b, n]) => br.addRow({ b, n })); head(br);
  const dy = wb.addWorksheet("By new date");
  dy.columns = [{ header: "Moved to", key: "d", width: 30 }, { header: "Changes", key: "n", width: 12 }];
  tally((x) => (x.type === "Moved" ? x.to : "Extended window")).forEach(([d, n]) => dy.addRow({ d, n })); head(dy);
  addScheduleSheet(wb, c, head);
  return { name: `${sc.test.name} - schedule changes`, buffer: Buffer.from(await wb.xlsx.writeBuffer()), rows: c.length };
}

/** Akhiran nama file: tanggal/rentang laporan yang dipilih; tanpa filter tanggal, tanggal unduh ("as-of"). */
export function fileDate(q: URLSearchParams) {
  const { from, to } = scopeFromQuery(q);
  if (from && to) return from === to ? from : `${from}_to_${to}`;
  if (from) return `${from}_onwards`;
  if (to) return `until_${to}`;
  return `as-of-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}`;
}

import { connectDB } from "./db";
import { collectTestRows, type ReportScope } from "./test-export";
import { TestSeat, TestSession } from "@/models/Schedule";
import { User } from "@/models/User";

export type ScheduleChange = {
  userId: string; name: string; email: string; branch: string; ageGroup: string;
  type: "Moved" | "Extended window";
  from: string; to: string; fromDay: string | null; toDay: string | null;
  at: Date | null; by: string; reason: string; source: "system" | "email" | "extension";
  status: string; attendance: string; score: number | null;
};

const day = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) : null);
const WIB = (d: Date) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Rekap perubahan jadwal satu tes: setiap pindah sesi (riwayat seat.moves) dan perpanjangan waktu individu (seat.override),
 * beserta status tes peserta saat ini. `sessionId`: hanya perubahan yang melibatkan sesi itu (asal atau tujuan).
 * Cakupan (institusi, cabang, umur, hanya hasil dirilis) mengikuti laporan; rentang tanggal memakai tanggal perubahan.
 */
export async function scheduleChanges(testId: string, opts: { sessionId?: string; scope?: ReportScope } = {}) {
  await connectDB();
  const { from, to, ...personScope } = opts.scope ?? {};
  const got = await collectTestRows(testId, new Date(), undefined, personScope);
  if (!got) return null;
  const rows = new Map(got.rows.filter((r) => !r.qa).map((r) => [r.userId, r]));
  const [sessions, seats] = await Promise.all([
    TestSession.find({ testId }).select("label opensAt").lean(),
    TestSeat.find({ testId, $or: [{ "moves.0": { $exists: true } }, { "override.at": { $exists: true } }] }).select("userId sessionId moves override").lean(),
  ]);
  const ses = new Map(sessions.map((s) => [String(s._id), s]));
  const byIds = [...new Set(seats.flatMap((s) => [...(s.moves ?? []).map((m) => m.by), s.override?.by]).filter(Boolean).map(String))];
  const admins = new Map((await User.find({ _id: { $in: byIds } }).select("name email").lean()).map((u) => [String(u._id), u.name || u.email]));
  const label = (id: unknown) => (id ? ses.get(String(id))?.label ?? "Removed session" : "Not recorded");
  const out: ScheduleChange[] = [];
  for (const seat of seats) {
    const r = rows.get(String(seat.userId));
    if (!r) continue; // di luar cakupan (institusi/cabang/umur) atau akun QA
    const base = { userId: r.userId, name: r.name, email: r.email, branch: r.branch, ageGroup: r.ageGroup, status: r.status, attendance: r.attendance, score: r.score };
    for (const m of seat.moves ?? []) {
      if (opts.sessionId && String(m.from) !== opts.sessionId && String(m.to) !== opts.sessionId) continue;
      out.push({ ...base, type: "Moved", from: label(m.from), to: label(m.to), fromDay: day(ses.get(String(m.from))?.opensAt), toDay: day(ses.get(String(m.to))?.opensAt), at: m.at ?? null, by: m.by ? admins.get(String(m.by)) ?? "" : "", reason: m.reason ?? "", source: (m.source as ScheduleChange["source"]) ?? "system" });
    }
    if (seat.override?.at && (!opts.sessionId || String(seat.sessionId) === opts.sessionId)) {
      const o = seat.override;
      out.push({ ...base, type: "Extended window", from: label(seat.sessionId), to: `${WIB(o.opensAt!)} – ${WIB(o.closesAt!)} WIB`, fromDay: day(ses.get(String(seat.sessionId))?.opensAt), toDay: day(o.opensAt), at: o.at ?? null, by: o.by ? admins.get(String(o.by)) ?? "" : "", reason: o.reason ?? "", source: "extension" });
    }
  }
  const inRange = (c: ScheduleChange) => { const d = day(c.at); return (!from || (!!d && d >= from)) && (!to || (!!d && d <= to)); };
  const list = out.filter(inRange).sort((a, b) => +(a.at ?? 0) - +(b.at ?? 0) || a.name.localeCompare(b.name));
  return { test: got.test, changes: list, people: new Set(list.map((c) => c.userId)).size };
}

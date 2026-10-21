import { Types } from "mongoose";
import { connectDB } from "./db";
import { effectiveWindow, spread, windowState, type SpreadMode } from "./schedule";
import { enqueueMail } from "./mailq";
import { TestSeat, TestSession } from "@/models/Schedule";
import { Test, Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { HttpError } from "./rbac";

const oid = (id: string) => new Types.ObjectId(id);
const LINK = () => `${process.env.APP_URL ?? "http://localhost:3000"}/tests`;

/** Peserta yang bisa dijadwalkan untuk tes ini: belum punya kursi, belum pernah menyelesaikan tes ini, dan tidak sedang mengerjakannya. */
export async function eligiblePool(testId: string, f: { institutionId?: string; emails?: string[] } = {}) {
  await connectDB();
  const filter: Record<string, unknown> = { role: "participant", status: { $in: ["active", "invited"] }, deletedAt: { $exists: false }, qaTester: { $ne: true } };
  if (f.institutionId) filter.institutionId = f.institutionId;
  if (f.emails?.length) filter.email = { $in: f.emails.map((e) => e.trim().toLowerCase()) };
  const [seated, busy] = await Promise.all([
    TestSeat.find({ testId }).distinct("userId"),
    Attempt.find({ testId, status: { $in: ["submitted", "in_progress"] } }).distinct("userId"),
  ]);
  const skip = new Set([...seated, ...busy].map(String));
  const users = await User.find(filter).select("name email institutionId").sort({ name: 1, email: 1 }).lean();
  const insts = new Map((await Institution.find().select("name").lean()).map((i) => [String(i._id), i.name]));
  return users.filter((u) => !skip.has(String(u._id))).map((u) => ({ id: String(u._id), name: u.name ?? null, email: u.email, institutionId: u.institutionId ? String(u.institutionId) : null, institution: u.institutionId ? insts.get(String(u.institutionId)) ?? null : null }));
}

export type SessionInput = { label: string; opensAt: Date; closesAt: Date; capacity: number };
export function validateSession(i: SessionInput) {
  if (!(i.closesAt > i.opensAt)) throw new HttpError(422, "The closing time must be after the opening time.");
  if (!Number.isInteger(i.capacity) || i.capacity < 1) throw new HttpError(422, "Capacity must be at least 1.");
}

async function seatCount(sessionId: Types.ObjectId | string) { return TestSeat.countDocuments({ sessionId }); }

/**
 * Pindahkan peserta ke sesi (atau keluarkan dengan sessionId = null). Aturan:
 * - kuota tujuan tidak boleh terlampaui;
 * - peserta yang sedang mengerjakan atau sudah menyelesaikan tes tidak dipindah;
 * - bila peserta sudah diundang dan jendelanya berubah, tanda "perlu email jadwal baru" otomatis muncul (dibandingkan saat kirim).
 */
export async function moveSeats(testId: string, userIds: string[], sessionId: string | null) {
  await connectDB();
  const ids = Array.from(new Set(userIds));
  const blocked = new Set((await Attempt.find({ testId, userId: { $in: ids }, status: { $in: ["submitted", "in_progress"] } }).distinct("userId")).map(String));
  const movable = ids.filter((id) => !blocked.has(id));
  if (sessionId == null) {
    await TestSeat.deleteMany({ testId, userId: { $in: movable } });
    return { moved: movable.length, blocked: ids.length - movable.length };
  }
  const session = await TestSession.findOne({ _id: sessionId, testId }).lean();
  if (!session) throw new HttpError(404, "Session not found");
  const already = new Set((await TestSeat.find({ testId, sessionId, userId: { $in: movable } }).distinct("userId")).map(String));
  const incoming = movable.filter((id) => !already.has(id));
  const used = await seatCount(sessionId);
  if (used + incoming.length > session.capacity) throw new HttpError(409, `${session.label} has ${Math.max(0, session.capacity - used)} free seats, but you are moving ${incoming.length} people. Raise the capacity first.`);
  const prev = new Map((await TestSeat.find({ testId, userId: { $in: incoming } }).select("userId sessionId").lean()).map((x) => [String(x.userId), x.sessionId]));
  for (const id of incoming) {
    const from = prev.get(id);
    await TestSeat.updateOne({ testId, userId: id }, { $set: { sessionId: session._id, ...(from ? { movedFrom: { sessionId: from, at: new Date() } } : {}) }, $unset: { override: "" } }, { upsert: true });
  }
  return { moved: incoming.length, blocked: ids.length - movable.length };
}

/** Sebar otomatis peserta kolam ke sesi yang masih punya ruang. `count` membatasi jumlah yang diambil (acak, mis. 200 dari 1388). */
export async function autoSpread(testId: string, o: { mode: SpreadMode; seed: string; institutionId?: string; emails?: string[]; count?: number }) {
  await connectDB();
  const sessions = await TestSession.find({ testId }).sort({ opensAt: 1 }).lean();
  if (!sessions.length) throw new HttpError(409, "Create at least one session first.");
  const filled = new Map<string, number>();
  for (const s of sessions) filled.set(String(s._id), await seatCount(s._id));
  let pool = await eligiblePool(testId, o);
  if (o.count && o.count > 0 && o.count < pool.length) {
    // Ambil sampel acak yang bisa diulang dengan seed yang sama.
    const picked = spread(pool.map((p) => ({ id: p.id })), [{ id: "x", capacity: o.count, filled: 0 }], "random", `${o.seed}:sample`).placed;
    pool = pool.filter((p) => picked.has(p.id));
  }
  const { placed, left } = spread(pool.map((p) => ({ id: p.id, group: p.institutionId })), sessions.map((s) => ({ id: String(s._id), capacity: s.capacity, filled: filled.get(String(s._id)) ?? 0 })), o.mode, o.seed);
  const ops = [...placed].map(([userId, sessionId]) => ({ updateOne: { filter: { testId: oid(testId), userId: oid(userId) }, update: { $set: { sessionId: oid(sessionId) } }, upsert: true } }));
  if (ops.length) await TestSeat.bulkWrite(ops);
  return { placed: placed.size, left: left.length, pool: pool.length };
}

/** Kirim undangan ke peserta yang belum diberi tahu, dan email jadwal baru ke yang jendelanya berubah sejak diundang. */
/** `sessionId` opsional: kirim hanya untuk satu sesi (mis. per tanggal, agar muat dalam batas email harian). */
export async function sendInvites(testId: string, sessionId?: string) {
  await connectDB();
  const test = await Test.findById(testId).select("name sections testMode").lean();
  if (!test) throw new HttpError(404, "Test not found");
  const sessions = new Map((await TestSession.find({ testId }).lean()).map((s) => [String(s._id), s]));
  // Urut menurut jam buka sesi: bila batas harian habis, yang paling dekat jadwalnya terkirim lebih dulu.
  const seats = (await TestSeat.find({ testId, ...(sessionId ? { sessionId } : {}) }).lean()).sort((a, b) => +(sessions.get(String(a.sessionId))?.opensAt ?? 0) - +(sessions.get(String(b.sessionId))?.opensAt ?? 0));
  const users = new Map((await User.find({ _id: { $in: seats.map((s) => s.userId) } }).select("name email qaTester").lean()).map((u) => [String(u._id), u]));
  const minutes = Math.round(test.sections.reduce((a, s) => a + s.durationSec, 0) / 60);
  const hasAudio = test.sections.some((s) => s.name === "listening");
  let invited = 0, rescheduled = 0, skipped = 0;
  for (const seat of seats) {
    const s = sessions.get(String(seat.sessionId)), u = users.get(String(seat.userId));
    if (!s || !u) continue;
    if (test.testMode && !u.qaTester) { skipped++; continue; } // tes yang masih diuji: email hanya untuk akun QA tester, jangan sampai peserta asli menerima undangan
    const w = effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, seat.override);
    const data = { name: u.name, test: test.name, opensAt: w.opensAt, closesAt: w.closesAt, minutes, hasAudio, link: LINK() };
    if (!seat.invitedAt) { await enqueueMail(u.email, "test_invitation", data); invited++; }
    else if (+(seat.invitedOpensAt ?? 0) !== +w.opensAt || +(seat.invitedClosesAt ?? 0) !== +w.closesAt) { await enqueueMail(u.email, "test_reschedule", { ...data, reason: seat.override?.reason }); rescheduled++; }
    else continue;
    await TestSeat.updateOne({ _id: seat._id }, { $set: { invitedAt: seat.invitedAt ?? new Date(), invitedOpensAt: w.opensAt, invitedClosesAt: w.closesAt }, $unset: { remindedOpenAt: "", remindedNowAt: "", remindedCloseAt: "" } });
  }
  return { invited, rescheduled, skipped };
}

/** Berapa orang akan menerima email bila admin menekan "kirim" sekarang (untuk pratinjau). */
export async function pendingInvites(testId: string) {
  await connectDB();
  const sessions = new Map((await TestSession.find({ testId }).lean()).map((s) => [String(s._id), s]));
  const test = await Test.findById(testId).select("testMode").lean();
  const seats = await TestSeat.find({ testId }).lean();
  const qa = test?.testMode ? new Set((await User.find({ _id: { $in: seats.map((x) => x.userId) }, qaTester: true }).select("_id").lean()).map((u) => String(u._id))) : null;
  let invite = 0, reschedule = 0, skipped = 0;
  for (const seat of seats) {
    const s = sessions.get(String(seat.sessionId));
    if (!s) continue;
    if (qa && !qa.has(String(seat.userId))) { skipped++; continue; }
    const w = effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, seat.override);
    if (!seat.invitedAt) invite++;
    else if (+(seat.invitedOpensAt ?? 0) !== +w.opensAt || +(seat.invitedClosesAt ?? 0) !== +w.closesAt) reschedule++;
  }
  return { invite, reschedule, skipped };
}

/** Perpanjangan atau jadwal ulang untuk SATU peserta; peserta langsung menerima email jadwal baru (lewat antrean). */
export async function extendSeat(testId: string, userId: string, w: { opensAt: Date; closesAt: Date }, reason: string, byId: string) {
  await connectDB();
  if (!(w.closesAt > w.opensAt)) throw new HttpError(422, "The closing time must be after the opening time.");
  const seat = await TestSeat.findOne({ testId, userId });
  if (!seat) throw new HttpError(404, "This participant has no seat in this test. Move them into a session first.");
  seat.override = { opensAt: w.opensAt, closesAt: w.closesAt, reason: reason.slice(0, 300), by: oid(byId), at: new Date() } as never;
  await seat.save();
  const [test, user] = await Promise.all([Test.findById(testId).select("name testMode").lean(), User.findById(userId).select("name email qaTester").lean()]);
  if (user && seat.invitedAt && (!test?.testMode || user.qaTester)) { await enqueueMail(user.email, "test_reschedule", { name: user.name, test: test?.name, opensAt: w.opensAt, closesAt: w.closesAt, reason, link: LINK() }); await TestSeat.updateOne({ _id: seat._id }, { $set: { invitedOpensAt: w.opensAt, invitedClosesAt: w.closesAt }, $unset: { remindedOpenAt: "", remindedNowAt: "", remindedCloseAt: "" } }); }
  return { ok: true, emailed: !!seat.invitedAt };
}

/**
 * Pengingat otomatis (dipanggil tiap jam): H-1 sebelum dibuka, dan sekitar 2 jam sebelum ditutup bagi yang belum mulai.
 * Hanya untuk kursi yang sudah diundang, belum pernah mulai tes ini, dan tiap pengingat dikirim sekali.
 */
export async function sendTestReminders(now = new Date()) {
  await connectDB();
  const tests = await Test.find({ scheduled: true, reminderMode: { $ne: "none" }, $or: [{ active: true }, { testMode: true }] }).select("name testMode reminderMode").lean(); // tes yang sedang diuji ikut, agar QA bisa memeriksa pengingatnya (email tetap hanya ke akun QA)
  let opening = 0, closing = 0, now_ = 0;
  for (const t of tests) {
    const sessions = new Map((await TestSession.find({ testId: t._id }).lean()).map((s) => [String(s._id), s]));
    const seats = await TestSeat.find({ testId: t._id, invitedAt: { $exists: true } }).lean();
    if (!seats.length) continue;
    const started = new Set((await Attempt.find({ testId: t._id, userId: { $in: seats.map((s) => s.userId) } }).distinct("userId")).map(String));
    const users = new Map((await User.find({ _id: { $in: seats.map((s) => s.userId) } }).select("name email qaTester").lean()).map((u) => [String(u._id), u]));
    for (const seat of seats) {
      const s = sessions.get(String(seat.sessionId)), u = users.get(String(seat.userId));
      if (!s || !u || started.has(String(seat.userId))) continue;
      if (t.testMode && !u.qaTester) continue; // tes yang masih diuji: pengingat hanya untuk akun QA tester
      const w = effectiveWindow({ opensAt: s.opensAt, closesAt: s.closesAt }, seat.override);
      const data = { name: u.name, test: t.name, opensAt: w.opensAt, closesAt: w.closesAt, link: LINK() };
      const hoursToOpen = (+w.opensAt - +now) / 3_600_000, hoursToClose = (+w.closesAt - +now) / 3_600_000;
      const closingOnly = t.reminderMode === "closing";
      if (!closingOnly && !seat.remindedOpenAt && hoursToOpen > 0 && hoursToOpen <= 24) { await enqueueMail(u.email, "test_reminder", { ...data, kind: "opening" }); await TestSeat.updateOne({ _id: seat._id }, { $set: { remindedOpenAt: now } }); opening++; }
      else if (!closingOnly && !seat.remindedNowAt && windowState(w, now) === "open" && hoursToClose > 2) { await enqueueMail(u.email, "test_reminder", { ...data, kind: "now" }); await TestSeat.updateOne({ _id: seat._id }, { $set: { remindedNowAt: now } }); now_++; }
      else if (!seat.remindedCloseAt && windowState(w, now) === "open" && hoursToClose <= 2) { await enqueueMail(u.email, "test_reminder", { ...data, kind: "closing" }); await TestSeat.updateOne({ _id: seat._id }, { $set: { remindedCloseAt: now } }); closing++; }
    }
  }
  return { opening, now: now_, closing };
}

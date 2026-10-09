import { isValidObjectId, type Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { getParam } from "./config";
import { audit } from "./audit";
import { notify } from "./notify";
import { enqueueMail } from "./mailq";
import { bookableLeft, canCancel, canMarkAttendance, canRegister, chargesQuota, overlaps, type AttendanceStatus } from "./coaching-rules";
import { Booking, CoachSlot, type SlotDoc } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";
import { User } from "@/models/User";

const APP = () => process.env.APP_URL ?? "http://localhost:3000";

type Actor = { _id: Types.ObjectId; role: string; institutionId?: Types.ObjectId | null };
export type SlotInput = { title?: string; startsAt: Date; endsAt: Date; mode: "online" | "offline"; meetingUrl?: string; room?: string; capacity: number; levelId?: string | null };

const mailBase = (s: Pick<SlotDoc, "startsAt" | "mode" | "meetingUrl" | "room">) => ({ startsAt: s.startsAt, mode: s.mode, meetingUrl: s.meetingUrl ?? "", room: s.room ?? "" });

async function loadSlot(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Slot not found");
  await connectDB();
  const s = await CoachSlot.findById(id);
  if (!s) throw new HttpError(404, "Slot not found");
  return s;
}
/** Hanya coach pemilik slot atau admin. */
function ownerOnly(actor: Actor, s: { coachId: Types.ObjectId }) {
  if (actor.role !== "admin" && String(s.coachId) !== String(actor._id)) throw new HttpError(403, "Not your slot");
}

async function assertNoConflict(coachId: Types.ObjectId, a: Date, b: Date, exceptId?: Types.ObjectId) {
  const clash = await CoachSlot.exists({ coachId, status: { $ne: "cancelled" }, startsAt: { $lt: b }, endsAt: { $gt: a }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw new HttpError(409, "This slot overlaps with another of your slots");
}
function checkTimes(i: SlotInput) {
  if (!(i.endsAt > i.startsAt)) throw new HttpError(400, "The end time must be after the start time");
  if (+i.endsAt - +i.startsAt > 4 * 3_600_000) throw new HttpError(400, "Maximum slot duration is 4 hours");
  if (i.startsAt <= new Date()) throw new HttpError(400, "The start time must be in the future");
  if (i.mode === "online" && i.meetingUrl && !/^https:\/\//i.test(i.meetingUrl)) throw new HttpError(400, "The meeting link must use https");
}

export async function createSlot(coach: Actor, i: SlotInput) {
  await connectDB();
  if (coach.role !== "coach" || !coach.institutionId) throw new HttpError(403, "Only coaches can create slots");
  checkTimes(i);
  await assertNoConflict(coach._id, i.startsAt, i.endsAt);
  const s = await CoachSlot.create({ ...i, levelId: i.levelId ?? undefined, coachId: coach._id, institutionId: coach.institutionId });
  await audit(coach._id, "slot.create", String(s._id));
  return s;
}

export async function setSlotStatus(actor: Actor, id: string, to: "published" | "draft") {
  const s = await loadSlot(id);
  ownerOnly(actor, s);
  if (s.status === "cancelled") throw new HttpError(409, "The slot is already cancelled");
  if (to === "published" && s.startsAt <= new Date()) throw new HttpError(409, "The slot has passed");
  if (to === "draft" && s.booked > 0) throw new HttpError(409, "The slot is already booked; cancel the slot if needed");
  s.status = to; await s.save();
  await audit(actor._id, `slot.${to}`, id);
  return s;
}

/** Ubah slot. Bila sudah ada peserta dan waktu/tempat berubah, peserta diberi tahu (kuota tidak berubah). */
export async function updateSlot(actor: Actor, id: string, i: SlotInput) {
  const s = await loadSlot(id);
  ownerOnly(actor, s);
  if (s.status === "cancelled") throw new HttpError(409, "The slot is already cancelled");
  checkTimes(i);
  if (i.capacity < s.booked) throw new HttpError(409, `Capacity cannot be lower than the registered participants (${s.booked})`);
  await assertNoConflict(s.coachId, i.startsAt, i.endsAt, s._id);
  const changed = +s.startsAt !== +i.startsAt || +s.endsAt !== +i.endsAt || s.mode !== i.mode || (s.room ?? "") !== (i.room ?? "") || (s.meetingUrl ?? "") !== (i.meetingUrl ?? "");
  s.set({ ...i, levelId: i.levelId ?? undefined, reminded: changed ? false : s.reminded });
  await s.save();
  if (changed && s.booked > 0) {
    const bs = await Booking.find({ slotId: s._id, status: "booked" }).lean();
    const users = await User.find({ _id: { $in: bs.map((b) => b.userId) } }).select("email").lean();
    for (const u of users) { await enqueueMail(u.email, "slot_changed", { startsAt: s.startsAt, link: `${APP()}/coaching` }); await notify(u._id, "slot_changed", { title: "Coaching schedule changed", body: s.startsAt.toLocaleString("en-GB"), href: "/coaching" }); }
  }
  await audit(actor._id, "slot.update", id, { notified: changed && s.booked > 0 });
  return s;
}

/** Coach membatalkan slot: semua booking aktif dibatalkan TANPA memakai kuota (quota_rules.coachCancelUsed=false) dan peserta diberi tahu. */
export async function cancelSlot(actor: Actor, id: string, reason: string) {
  const s = await loadSlot(id);
  ownerOnly(actor, s);
  if (s.status === "cancelled") return s;
  const rules = await getParam("quota_rules");
  const bs = await Booking.find({ slotId: s._id, status: "booked" });
  for (const b of bs) {
    b.status = "cancelled"; b.active = false; b.cancelledBy = actor.role === "admin" ? "admin" : "coach";
    if (rules.coachCancelUsed && !b.quotaCharged) { await adjustQuota(b.userId, +1); b.quotaCharged = true; }
    await b.save();
  }
  s.status = "cancelled"; s.cancelReason = reason; s.booked = 0; await s.save();
  const users = await User.find({ _id: { $in: bs.map((b) => b.userId) } }).select("email").lean();
  for (const u of users) { await enqueueMail(u.email, "slot_cancelled", { startsAt: s.startsAt, link: `${APP()}/coaching` }); await notify(u._id, "slot_cancelled", { title: "Coaching session cancelled by the coach", body: "Your quota is not reduced. Choose a replacement slot.", href: "/coaching" }); }
  await audit(actor._id, "slot.cancel", id, { reason, bookings: bs.length });
  return s;
}

async function activeQuota(userId: Types.ObjectId | string) {
  return CoachingQuota.findOne({ userId, active: true });
}
async function adjustQuota(userId: Types.ObjectId | string, delta: 1 | -1) {
  const q = await activeQuota(userId);
  if (!q) return;
  await CoachingQuota.updateOne({ _id: q._id, ...(delta < 0 ? { used: { $gt: 0 } } : {}) }, { $inc: { used: delta } });
}

/** Booking atomik: kapasitas dijaga lewat update bersyarat, jadi dua peserta tidak bisa merebut kursi terakhir bersamaan. */
export async function bookSlot(user: Actor & { currentLevelId?: Types.ObjectId | null }, slotId: string) {
  const s = await loadSlot(slotId);
  if (!user.institutionId || String(s.institutionId) !== String(user.institutionId)) throw new HttpError(404, "Slot not found");
  if (s.status !== "published") throw new HttpError(409, "Slot not available");
  if (s.levelId && String(s.levelId) !== String(user.currentLevelId)) throw new HttpError(403, "This slot is for another level");
  const booking = await getParam("booking");
  if (!canRegister(new Date(), s.startsAt, booking.registerBeforeHours)) throw new HttpError(409, `Registration closes ${booking.registerBeforeHours} hours before the session`);

  const q = await activeQuota(user._id);
  if (!q) throw new HttpError(403, "No coaching quota yet. Finish the placement test first.");
  const mine = await Booking.find({ userId: user._id, status: "booked" }).lean();
  const upcomingSlots = await CoachSlot.find({ _id: { $in: mine.map((b) => b.slotId) }, startsAt: { $gt: new Date() } }).select("startsAt endsAt").lean();
  if (bookableLeft(q.total, q.used, upcomingSlots.length) <= 0) throw new HttpError(409, "Coaching quota used up (including sessions you have already booked)");
  if (upcomingSlots.some((x) => overlaps(x.startsAt, x.endsAt, s.startsAt, s.endsAt))) throw new HttpError(409, "You already have a session at the same time");

  const got = await CoachSlot.findOneAndUpdate({ _id: s._id, status: "published", $expr: { $lt: ["$booked", "$capacity"] } }, { $inc: { booked: 1 } }, { new: true });
  if (!got) throw new HttpError(409, "The slot is full");
  try {
    const b = await Booking.create({ slotId: s._id, userId: user._id, coachId: s.coachId, institutionId: s.institutionId });
    const coach = await User.findById(s.coachId).select("name").lean();
    const me = await User.findById(user._id).select("email").lean();
    if (me) await enqueueMail(me.email, "booking_confirmed", { coach: coach?.name ?? "Coach", ...mailBase(s) });
    await notify(user._id, "booking_confirmed", { title: "Coaching booking confirmed", body: s.startsAt.toLocaleString("en-GB"), href: "/coaching" });
    await notify(s.coachId, "booking_new", { title: "A participant booked your slot", body: s.startsAt.toLocaleString("en-GB"), href: "/coach/sesi" });
    await audit(user._id, "booking.create", String(b._id));
    return b;
  } catch (e) {
    await CoachSlot.updateOne({ _id: s._id }, { $inc: { booked: -1 } }); // lepas kursi bila booking gagal (mis. dobel)
    if ((e as { code?: number }).code === 11000) throw new HttpError(409, "You are already registered for this slot");
    throw e;
  }
}

export async function cancelBooking(user: Actor, bookingId: string) {
  if (!isValidObjectId(bookingId)) throw new HttpError(404, "Booking not found");
  await connectDB();
  const b = await Booking.findOne({ _id: bookingId, userId: user._id });
  if (!b) throw new HttpError(404, "Booking not found");
  const s = await CoachSlot.findById(b.slotId);
  if (!s) throw new HttpError(404, "Slot not found");
  const { cancelBeforeHours } = await getParam("booking");
  if (!canCancel(new Date(), s.startsAt, cancelBeforeHours)) throw new HttpError(409, `Self-cancellation is possible up to ${cancelBeforeHours} hours before the session. Contact your coach for an excused absence.`);
  const r = await Booking.updateOne({ _id: b._id, status: "booked" }, { status: "cancelled", active: false, cancelledBy: "participant" });
  if (!r.modifiedCount) throw new HttpError(409, "The booking is no longer active");
  await CoachSlot.updateOne({ _id: s._id, booked: { $gt: 0 } }, { $inc: { booked: -1 } });
  await audit(user._id, "booking.cancel", bookingId);
}

/**
 * Catat kehadiran (MTS §16.3). Kuota idempoten: perubahan `quotaCharged` dilakukan dengan update bersyarat, dan
 * `used` hanya berubah bila update itu benar-benar terjadi, jadi klik ganda/koreksi tidak menggandakan potongan.
 */
export async function markAttendance(actor: Actor, bookingId: string, status: AttendanceStatus) {
  if (!isValidObjectId(bookingId)) throw new HttpError(404, "Booking not found");
  await connectDB();
  const b = await Booking.findById(bookingId);
  if (!b || b.status === "cancelled") throw new HttpError(404, "Booking not found");
  const s = await CoachSlot.findById(b.slotId);
  if (!s || s.status === "cancelled") throw new HttpError(409, "Slot cancelled");
  ownerOnly(actor, s);
  if (!canMarkAttendance(new Date(), s.startsAt)) throw new HttpError(409, "Attendance can only be recorded after the session starts");

  const rules = await getParam("quota_rules");
  const want = chargesQuota(status, rules);
  b.status = status; b.markedAt = new Date();
  await Booking.updateOne({ _id: b._id }, { status, markedAt: b.markedAt });
  if (want !== b.quotaCharged) {
    const flipped = await Booking.updateOne({ _id: b._id, quotaCharged: !want }, { quotaCharged: want });
    if (flipped.modifiedCount) await adjustQuota(b.userId, want ? 1 : -1);
  }
  await audit(actor._id, "attendance.mark", bookingId, { status });
  return { status, charged: want };
}

/** Pengingat H-1: slot terbit yang mulai dalam 24 jam, belum diingatkan. Dipanggil job per jam. */
export async function sendSessionReminders() {
  await connectDB();
  const now = new Date();
  const slots = await CoachSlot.find({ status: "published", reminded: false, startsAt: { $gt: now, $lte: new Date(+now + 24 * 3_600_000) } });
  let sent = 0;
  for (const s of slots) {
    const claimed = await CoachSlot.updateOne({ _id: s._id, reminded: false }, { reminded: true });
    if (!claimed.modifiedCount) continue;
    const bs = await Booking.find({ slotId: s._id, status: "booked" }).lean();
    const users = await User.find({ _id: { $in: bs.map((b) => b.userId) } }).select("email").lean();
    for (const u of users) { await enqueueMail(u.email, "session_reminder", mailBase(s)); await notify(u._id, "session_reminder", { title: "Reminder: coaching session tomorrow", body: s.startsAt.toLocaleString("en-GB"), href: "/coaching" }); sent++; }
  }
  return { slots: slots.length, emails: sent };
}

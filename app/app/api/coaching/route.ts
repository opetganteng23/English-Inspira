import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { getParam } from "@/lib/config";
import { bookableLeft } from "@/lib/coaching-rules";
import { Booking, CoachSlot, SessionNote } from "@/models/Coaching";
import { CoachingQuota } from "@/models/Config";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Coaching peserta: kuota, slot terbuka (institusi + level sendiri), booking saya beserta catatan yang dibagikan coach. */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    const [quota, booking] = await Promise.all([CoachingQuota.findOne({ userId: me._id, active: true }).lean(), getParam("booking")]);
    const mine = await Booking.find({ userId: me._id, active: true }).sort({ createdAt: -1 }).limit(100).lean();
    const mySlots = await CoachSlot.find({ _id: { $in: mine.map((b) => b.slotId) } }).lean();
    const sl = new Map(mySlots.map((s) => [String(s._id), s]));
    const [coaches, notes] = await Promise.all([
      User.find({ _id: { $in: mySlots.map((s) => s.coachId) } }).select("name").lean(),
      SessionNote.find({ bookingId: { $in: mine.map((b) => b._id) } }).select("bookingId shared").lean(),
    ]);
    const cn = new Map(coaches.map((c) => [String(c._id), c.name])), nt = new Map(notes.map((n) => [String(n.bookingId), n.shared]));

    const upcomingMine = mine.filter((b) => b.status === "booked" && (sl.get(String(b.slotId))?.startsAt ?? 0) > new Date());
    const booked = new Set(mine.filter((b) => b.status !== "cancelled").map((b) => String(b.slotId)));
    const open = me.institutionId && quota
      ? await CoachSlot.find({ institutionId: me.institutionId, status: "published", startsAt: { $gt: new Date(Date.now() + booking.registerBeforeHours * 3_600_000) }, $or: [{ levelId: { $exists: false } }, { levelId: me.currentLevelId }], $expr: { $lt: ["$booked", "$capacity"] } }).sort({ startsAt: 1 }).limit(60).lean()
      : [];
    const openCoaches = new Map((await User.find({ _id: { $in: open.map((s) => s.coachId) } }).select("name").lean()).map((c) => [String(c._id), c.name]));

    return NextResponse.json({
      quota: quota ? { total: quota.total, used: quota.used, bookable: bookableLeft(quota.total, quota.used, upcomingMine.length) } : null,
      rules: { registerBeforeHours: booking.registerBeforeHours, cancelBeforeHours: booking.cancelBeforeHours },
      open: open.filter((s) => !booked.has(String(s._id))).map((s) => ({ id: String(s._id), title: s.title ?? "", coach: openCoaches.get(String(s.coachId)) ?? "Coach", startsAt: s.startsAt, endsAt: s.endsAt, mode: s.mode, room: s.room ?? "", left: s.capacity - s.booked })),
      bookings: mine.map((b) => {
        const s = sl.get(String(b.slotId));
        return {
          id: String(b._id), status: b.status, startsAt: s?.startsAt ?? null, endsAt: s?.endsAt ?? null, mode: s?.mode ?? "online", meetingUrl: b.status === "booked" ? s?.meetingUrl ?? "" : "", room: s?.room ?? "",
          coach: cn.get(String(s?.coachId)) ?? "Coach", slotCancelled: s?.status === "cancelled", quotaCharged: b.quotaCharged, note: nt.get(String(b._id)) ?? "",
          canCancel: b.status === "booked" && !!s && +s.startsAt - Date.now() >= booking.cancelBeforeHours * 3_600_000,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Booking, CoachSlot, SessionNote } from "@/models/Coaching";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Sesi coach: slot yang punya peserta (14 hari ke belakang dan seterusnya) beserta daftar peserta, kehadiran, dan catatan. */
export async function GET() {
  try {
    const me = await requireRole(["coach", "admin"]);
    await connectDB();
    const slots = await CoachSlot.find({ ...(me.role === "admin" ? {} : { coachId: me._id }), status: { $ne: "cancelled" }, booked: { $gt: 0 }, startsAt: { $gte: new Date(Date.now() - 14 * 86_400_000) } }).sort({ startsAt: 1 }).limit(100).lean();
    const bookings = await Booking.find({ slotId: { $in: slots.map((s) => s._id) }, active: true }).lean();
    const [users, notes] = await Promise.all([
      User.find({ _id: { $in: bookings.map((b) => b.userId) } }).select("name email").lean(),
      SessionNote.find({ bookingId: { $in: bookings.map((b) => b._id) } }).lean(),
    ]);
    const u = new Map(users.map((x) => [String(x._id), x])), n = new Map(notes.map((x) => [String(x.bookingId), x]));
    return NextResponse.json({
      sessions: slots.map((s) => ({
        id: String(s._id), title: s.title ?? "", startsAt: s.startsAt, endsAt: s.endsAt, mode: s.mode, room: s.room ?? "", meetingUrl: s.meetingUrl ?? "",
        bookings: bookings.filter((b) => String(b.slotId) === String(s._id)).map((b) => {
          const note = n.get(String(b._id));
          return {
            id: String(b._id), userId: String(b.userId), name: u.get(String(b.userId))?.name ?? u.get(String(b.userId))?.email ?? "-", status: b.status, quotaCharged: b.quotaCharged,
            note: note ? { private: note.private ?? "", shared: note.shared ?? "", recommendLevelUp: !!note.recommendLevelUp } : null,
          };
        }),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

import { connectDB } from "./db";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { CoachingQuota } from "@/models/Config";
import { Booking, CoachSlot } from "@/models/Coaching";

/**
 * Pantauan coaching per institusi aktif (MTS §16.5): sisa kuota peserta vs kursi slot terbuka sampai kontrak berakhir,
 * kehadiran, dan peringatan. Dipakai halaman admin dan job peringatan kuota.
 */
export async function coachingMonitor() {
  await connectDB();
  const now = new Date();
  const out = [];
  for (const i of await Institution.find({ status: "active" }).lean()) {
    const [quotas, openSlots, bookings, coaches, participants] = await Promise.all([
      CoachingQuota.find({ institutionId: i._id, active: true }).lean(),
      CoachSlot.find({ institutionId: i._id, status: "published", startsAt: { $gt: now, ...(i.contractEnd ? { $lte: i.contractEnd } : {}) } }).select("capacity booked").lean(),
      Booking.find({ institutionId: i._id, active: true, status: { $in: ["present", "absent", "excused"] } }).select("status").lean(),
      User.countDocuments({ institutionId: i._id, role: "coach", status: { $ne: "disabled" } }),
      User.countDocuments({ institutionId: i._id, role: "participant", status: "active" }),
    ]);
    const remaining = quotas.reduce((a, q) => a + Math.max(0, q.total - q.used), 0);
    const seatsLeft = openSlots.reduce((a, s) => a + Math.max(0, s.capacity - s.booked), 0);
    const marked = bookings.length, present = bookings.filter((b) => b.status === "present").length, absent = bookings.filter((b) => b.status === "absent").length;
    const warnings: string[] = [];
    if (participants > 0 && coaches === 0) warnings.push("Belum ada coach untuk institusi ini.");
    if (remaining > 0 && seatsLeft < remaining) warnings.push(`Kuota tersisa ${remaining} sesi, tetapi kursi slot terbuka sampai kontrak berakhir hanya ${seatsLeft}.`);
    out.push({ id: String(i._id), name: i.name, contractEnd: i.contractEnd ?? null, coaches, participants, quotaRemaining: remaining, openSeats: seatsLeft, sessionsMarked: marked, presentPct: marked ? Math.round((present / marked) * 100) : null, absent, warnings });
  }
  return out;
}

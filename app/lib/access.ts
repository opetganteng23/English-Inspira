import type { Types } from "mongoose";
import { connectDB } from "./db";
import { Enrollment } from "@/models/Access";

const activeFilter = (userId: Types.ObjectId | string) => {
  const now = new Date();
  return { userId, status: "active", startsAt: { $lte: now }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] };
};

/** Akses selalu dicek dari enrollment (status + expiresAt). Kontrak berakhir → enrollment berakhir → login ditolak. */
export async function hasActiveEnrollment(userId: Types.ObjectId | string) {
  await connectDB();
  return !!(await Enrollment.exists(activeFilter(userId) as never));
}

export async function activeEnrollment(userId: Types.ObjectId | string) {
  await connectDB();
  return Enrollment.findOne(activeFilter(userId) as never).lean();
}

/** Enrollment yang sah tetapi belum dimulai (kontrak institusi mulai di masa depan). */
export async function upcomingEnrollment(userId: Types.ObjectId | string) {
  await connectDB();
  const now = new Date();
  return Enrollment.findOne({ userId, status: "active", startsAt: { $gt: now }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] } as never).sort({ startsAt: 1 }).lean();
}

export const startDate = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";

/** Pesan penolakan masuk yang jelas: belum dimulai (dengan tanggalnya) atau sudah berakhir. */
export async function accessDeniedMessage(userId: Types.ObjectId | string) {
  const up = await upcomingEnrollment(userId);
  return up?.startsAt ? `Your access starts on ${startDate(up.startsAt)}. Please sign in again from then.` : "Your access has ended. Contact your institution.";
}

/** Tandai enrollment kedaluwarsa (dijalankan job harian). */
export async function expireEnrollments(now = new Date()) {
  await connectDB();
  const r = await Enrollment.updateMany({ status: "active", expiresAt: { $lte: now } }, { status: "expired" });
  return r.modifiedCount;
}

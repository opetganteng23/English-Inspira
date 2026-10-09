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

/** Tandai enrollment kedaluwarsa (dijalankan job harian). */
export async function expireEnrollments(now = new Date()) {
  await connectDB();
  const r = await Enrollment.updateMany({ status: "active", expiresAt: { $lte: now } }, { status: "expired" });
  return r.modifiedCount;
}

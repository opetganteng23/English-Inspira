import type { Types } from "mongoose";
import { connectDB } from "./db";
import { Notification } from "@/models/Access";
import { User } from "@/models/User";

// Notifikasi dalam aplikasi (MTS §18). Memakai kisah yang sama dengan email, tetapi tidak pernah memblokir alur utama.
export type NotifyInput = { title: string; body?: string; href?: string };

/** Catat satu notifikasi. Kegagalan hanya dicatat ke log. `dedupeKey` mencegah notifikasi ganda untuk peristiwa yang sama. */
export async function notify(userId: Types.ObjectId | string, type: string, n: NotifyInput, dedupeKey?: string) {
  try {
    await connectDB();
    if (dedupeKey && (await Notification.exists({ userId, type, "payload.key": dedupeKey }))) return;
    await Notification.create({ userId, type, payload: { ...n, ...(dedupeKey ? { key: dedupeKey } : {}) } });
  } catch (e) {
    console.error("[notify]", (e as Error).message);
  }
}

export async function notifyAdmins(type: string, n: NotifyInput, dedupeKey?: string) {
  await connectDB();
  const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
  for (const a of admins) await notify(a._id, type, n, dedupeKey);
}

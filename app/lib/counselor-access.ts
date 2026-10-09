import type { Types } from "mongoose";
import { connectDB } from "./db";
import { getParam } from "./config";
import { CounselorThread } from "@/models/Counselor";

/** Kuota Konselor AI: `counselor_quota` pesan per bulan (kalender, zona Asia/Jakarta) per peserta (MTS §5, §17). */
export async function counselorAccess(userId: Types.ObjectId | string) {
  await connectDB();
  const quota = await getParam("counselor_quota");
  const now = new Date();
  // Awal bulan WIB (UTC+7)
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const start = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000);
  const next = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + 1, 1) - 7 * 3600_000);

  const agg = await CounselorThread.aggregate([
    { $match: { userId: typeof userId === "string" ? new (await import("mongoose")).Types.ObjectId(userId) : userId } },
    { $unwind: "$messages" },
    { $match: { "messages.role": "user", "messages.at": { $gte: start } } },
    { $count: "n" },
  ]);
  const used = agg[0]?.n ?? 0;
  const allowed = used < quota;
  return { allowed, used, quota, remaining: Math.max(0, quota - used), resetsAt: next, reason: allowed ? null : `The limit of ${quota} messages this month has been reached. The quota resets on ${next.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.` };
}

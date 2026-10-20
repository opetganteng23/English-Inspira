import mongoose, { Schema, Model, Types } from "mongoose";
import { connectDB } from "./db";
import { audit } from "./audit";
import { HttpError } from "./rbac";
import { Attempt, AttemptSnapshot } from "@/models/Test";
import { ClassMember } from "@/models/Cluster";
import { User } from "@/models/User";

// Arsip percobaan yang dibatalkan admin (mis. gangguan sistem). Dokumen asli disimpan utuh, tidak dihapus permanen.
const voidSchema = new Schema({ attempt: Schema.Types.Mixed, snapshot: Schema.Types.Mixed, userId: Schema.Types.ObjectId, testId: Schema.Types.ObjectId, reason: String, by: Schema.Types.ObjectId, at: { type: Date, default: Date.now } });
type VoidDoc = { attempt: unknown; snapshot?: unknown; userId: Types.ObjectId; testId: Types.ObjectId; reason: string; by: Types.ObjectId; at: Date };
export const VoidedAttempt: Model<VoidDoc> = (mongoose.models.VoidedAttempt as Model<VoidDoc>) || mongoose.model<VoidDoc>("VoidedAttempt", voidSchema);

/** Efek hasil (level, kuota, email, analisis) belum dijalankan: percobaan masih aman dibatalkan tanpa memutar balik apa pun. */
export const isVoidable = (a: { status: string; releaseAt?: Date | null; releasedAt?: Date | null }) =>
  a.status === "in_progress" || (a.status === "submitted" && !!a.releaseAt && !a.releasedAt);

/**
 * Batalkan satu percobaan: arsipkan, keluarkan dari hasil, lepas kelas yang terbentuk dari skor tertahan,
 * sehingga peserta bisa dijadwalkan dan mengerjakan ulang.
 */
export async function voidAttempt(attemptId: string, userId: string, adminId: Types.ObjectId, reason: string) {
  await connectDB();
  const a = await Attempt.findOne({ _id: attemptId, userId }).lean();
  if (!a) throw new HttpError(404, "Attempt not found");
  if (!isVoidable(a)) throw new HttpError(409, "This result has already been released (level, quota, and emails applied), so it cannot be voided here.");
  const snapshot = await AttemptSnapshot.findOne({ attemptId: a._id }).lean();
  await VoidedAttempt.create({ attempt: a, snapshot: snapshot ?? undefined, userId: a.userId, testId: a.testId, reason, by: adminId });
  await Attempt.deleteOne({ _id: a._id });
  if (snapshot) await AttemptSnapshot.deleteOne({ _id: snapshot._id });
  // Kelas yang dibentuk dari skor placement tertahan ikut dilepas (level belum ditetapkan dari percobaan ini).
  let classLeft = 0;
  const u = await User.findById(a.userId).select("placementAttemptId").lean();
  if (a.kind === "placement" && !u?.placementAttemptId) classLeft = (await ClassMember.updateMany({ userId: a.userId, active: true }, { active: false, leftAt: new Date() })).modifiedCount;
  await audit(adminId, "attempt.void", String(a._id), { userId: String(a.userId), testId: String(a.testId), score: a.scoreEst ?? null, status: a.status, reason, classLeft });
  return { classLeft };
}

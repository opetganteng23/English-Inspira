import type { Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError, requireRole, scopeByInstitution } from "./rbac";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { CounselorThread } from "@/models/Counselor";

/**
 * Konteks portal institusi. inst_admin SELALU dibatasi ke institusinya sendiri (parameter query diabaikan);
 * admin boleh memilih institusi lewat ?institution=<id>. Semua query peserta wajib lewat scoped().
 */
export async function instContext(req: Request) {
  const user = await requireRole(["inst_admin", "admin"]);
  await connectDB();
  let institutionId: Types.ObjectId | string | undefined = user.institutionId ?? undefined;
  if (user.role === "admin") {
    institutionId = new URL(req.url).searchParams.get("institution") ?? undefined;
    if (!institutionId || !/^[0-9a-f]{24}$/.test(institutionId)) throw new HttpError(400, "Pilih institusi (?institution=<id>)");
  }
  if (!institutionId) throw new HttpError(403, "Akun institusi belum terhubung");
  const inst = await Institution.findById(institutionId).lean();
  if (!inst) throw new HttpError(404, "Institusi tidak ditemukan");
  const scoped = (filter: Record<string, unknown> = {}) =>
    user.role === "inst_admin" ? scopeByInstitution(user, { role: "participant", ...filter } as never) : { role: "participant", institutionId: inst._id, ...filter };
  return { user, inst, scoped: scoped as (f?: Record<string, unknown>) => Record<string, unknown> };
}

/** Ringkasan hasil per peserta institusi: skor awal, skor terakhir, jumlah tes, aktivitas terakhir. */
export async function memberResults(ids: Types.ObjectId[]) {
  const attempts = await Attempt.find({ userId: { $in: ids }, status: "submitted" }).sort({ finishedAt: 1 }).select("userId kind scoreEst sectionScores finishedAt").lean();
  const by = new Map<string, typeof attempts>();
  for (const a of attempts) { const k = String(a.userId); by.set(k, [...(by.get(k) ?? []), a]); }
  return by;
}

export async function activeCounselors(ids: Types.ObjectId[], days = 7) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await CounselorThread.distinct("userId", { userId: { $in: ids }, updatedAt: { $gte: since } });
  return new Set(rows.map(String));
}

export async function memberIds(scopedFilter: Record<string, unknown>) {
  return (await User.find(scopedFilter).select("_id").lean()).map((u) => u._id);
}

import type { Types } from "mongoose";
/** Penahanan hasil: hasil tes baru keluar pada `releaseAt` (waktu mulai + Test.resultDelayMin). Admin dan QA tester dikecualikan. */
export const exemptFromDelay = (u: { role: string; qaTester?: boolean | null }) => u.role === "admin" || !!u.qaTester;

export const isReleased = (a: { releaseAt?: Date | null }, now = new Date()) => !a.releaseAt || a.releaseAt <= now;

/** Filter Mongo untuk percobaan yang hasilnya sudah boleh dilihat peserta. */
export const releasedFilter = (now = new Date()) => ({ $or: [{ releaseAt: { $exists: false } }, { releaseAt: null }, { releaseAt: { $lte: now } }] });

/** `releaseAt` untuk percobaan baru, atau undefined bila hasil langsung keluar. */
export function releaseAtFor(test: { resultDelayMin?: number | null }, user: { role: string; qaTester?: boolean | null }, startedAt: Date) {
  const min = test.resultDelayMin ?? 0;
  return min > 0 && !exemptFromDelay(user) ? new Date(+startedAt + min * 60_000) : undefined;
}

/** Percobaan yang hasilnya ditahan dan efeknya (level, kuota, email) belum dijalankan, termasuk yang sudah lewat waktu rilis tetapi belum diproses. */
export const pendingEffectsFilter = { releaseAt: { $exists: true }, releasedAt: { $exists: false } };

/** Tanggal "tanpa batas" untuk hasil yang ditahan institusi: dilepas hanya oleh admin pusat. */
export const HOLD_UNTIL = new Date("9999-12-31T00:00:00Z");
export const isOrgHold = (d?: Date | string | null) => !!d && new Date(d).getUTCFullYear() >= 9000;


export const fmtRelease = (d: Date | string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";

/** Lepas hasil yang ditahan institusi (satu institusi atau satu peserta): jatuh tempo sekarang, efek dijalankan cron/di bawah. */
export async function releaseOrgHeld(filter: { institutionId?: Types.ObjectId; userId?: Types.ObjectId }) {
  const { Attempt } = await import("@/models/Test");
  const r = await Attempt.updateMany({ ...filter, heldByOrg: true, releasedAt: { $exists: false } }, { $set: { releaseAt: new Date() }, $unset: { heldByOrg: 1 } });
  const { releaseDueResults } = await import("./attempts");
  void releaseDueResults(2000).catch((e) => console.error("[release-org]", e));
  return r.modifiedCount;
}

/** Saat penahanan dinyalakan: placement yang sedang dikerjakan peserta institusi ikut ditahan. */
export async function holdInProgress(institutionId: Types.ObjectId) {
  const { Attempt } = await import("@/models/Test");
  const { User } = await import("@/models/User");
  const qa = await User.find({ institutionId, qaTester: true }).distinct("_id");
  const r = await Attempt.updateMany({ institutionId, kind: "placement", status: "in_progress", userId: { $nin: qa } }, { $set: { releaseAt: HOLD_UNTIL, heldByOrg: true } });
  return r.modifiedCount;
}

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

export const fmtRelease = (d: Date | string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";

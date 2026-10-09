// Aturan murni coaching (MTS §16). Tanpa akses DB agar mudah diuji.

export type AttendanceStatus = "present" | "absent" | "excused";
export type QuotaRules = { presentUsed: boolean; absentUsed: boolean; excusedOnTimeUsed: boolean; coachCancelUsed: boolean };

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

const HOUR = 3_600_000;
/** Daftar paling lambat `hours` jam sebelum sesi mulai. */
export const canRegister = (now: Date, startsAt: Date, hours: number) => +startsAt - +now >= hours * HOUR;
/** Batal mandiri paling lambat `hours` jam sebelum sesi mulai; lewat itu peserta harus menghubungi coach. */
export const canCancel = (now: Date, startsAt: Date, hours: number) => +startsAt - +now >= hours * HOUR;

/** Apakah status kehadiran ini memakai kuota menurut aturan yang diatur admin. */
export function chargesQuota(status: AttendanceStatus, rules: QuotaRules) {
  return status === "present" ? rules.presentUsed : status === "absent" ? rules.absentUsed : rules.excusedOnTimeUsed;
}

/** Sisa kuota yang bisa dipakai booking baru: kuota − terpakai − booking aktif yang akan datang. */
export const bookableLeft = (total: number, used: number, upcoming: number) => Math.max(0, total - used - upcoming);

/** Slot dianggap sudah selesai (boleh dicatat kehadirannya) setelah waktu mulai. */
export const canMarkAttendance = (now: Date, startsAt: Date) => +now >= +startsAt;

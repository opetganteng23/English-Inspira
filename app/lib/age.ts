/** Kelompok umur untuk filter, analisis, dan laporan (laporan hanya menampilkan kelompok, bukan tanggal lahir). */
export const AGE_GROUPS = [
  { key: "lt30", label: "< 30", min: 0, max: 30 },
  { key: "30-34", label: "30–34", min: 30, max: 35 },
  { key: "35-39", label: "35–39", min: 35, max: 40 },
  { key: "40-44", label: "40–44", min: 40, max: 45 },
  { key: "45-49", label: "45–49", min: 45, max: 50 },
  { key: "50+", label: "50+", min: 50, max: 200 },
] as const;
export type AgeKey = (typeof AGE_GROUPS)[number]["key"];

/** Umur dalam tahun penuh pada tanggal `at`. */
export function ageOf(birth: Date | string | null | undefined, at = new Date()) {
  if (!birth) return null;
  const b = new Date(birth);
  let a = at.getUTCFullYear() - b.getUTCFullYear();
  if (at.getUTCMonth() < b.getUTCMonth() || (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
export const ageGroupOf = (age: number | null) => (age == null ? null : AGE_GROUPS.find((g) => age >= g.min && age < g.max) ?? null);

/** Filter Mongo tanggal lahir untuk satu kelompok umur. */
export function birthRange(key: string, at = new Date()) {
  const g = AGE_GROUPS.find((x) => x.key === key);
  if (!g) return null;
  const y = (n: number) => new Date(Date.UTC(at.getUTCFullYear() - n, at.getUTCMonth(), at.getUTCDate()));
  // umur >= min  <=> lahir <= at - min ; umur < max <=> lahir > at - max
  return { $lte: y(g.min), $gt: y(g.max) };
}

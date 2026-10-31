import { notFound } from "next/navigation";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { getCurrentUser } from "./auth";
import { getSetting } from "@/models/Settings";
import { Institution } from "@/models/Institution";

// Saklar fitur yang diatur admin di Settings. Fitur mati = menu, halaman, dan API-nya hilang untuk semua peran; datanya tetap.
// Semua mati sejak awal (keputusan 30 Okt 2026): yang dipakai sehari-hari hanya tes, hasil, dan laporan.
export const FEATURE_DEFAULTS = { aiCounselor: false, learning: false, coaching: false, officialTest: false, certificates: false, externalResults: false, programCycles: false, aiSupport: false };
export type Features = typeof FEATURE_DEFAULTS;
export type FeatureKey = keyof Features;

/** Modul yang juga dinyalakan per institusi (Settings institusi). Peserta institusi hanya melihatnya bila saklar global DAN modul institusinya menyala. */
export const INSTITUTION_MODULES = ["learning", "coaching"] as const;
export type InstitutionModule = (typeof INSTITUTION_MODULES)[number];

export async function getFeatures(): Promise<Features> {
  await connectDB();
  return getSetting("features", FEATURE_DEFAULTS);
}

/** Fitur yang berlaku bagi satu pengguna: saklar global, dipersempit modul institusinya untuk peserta, coach, dan admin institusi. */
export async function featuresFor(user: { role: string; institutionId?: unknown } | null): Promise<Features> {
  const f = { ...(await getFeatures()) };
  if (user && user.role !== "admin" && user.role !== "academic_admin" && user.role !== "content_editor" && user.institutionId) {
    const inst = await Institution.findById(user.institutionId).select("modules").lean();
    for (const k of INSTITUTION_MODULES) f[k] = f[k] && !!inst?.modules?.[k];
  }
  return f;
}

/** Dipanggil di awal handler API fitur. Fitur mati dijawab 404 seolah tidak ada. */
export async function requireFeature(k: FeatureKey) {
  if (!(await getFeatures())[k]) throw new HttpError(404, "This feature is not available");
}

/** Untuk layout halaman fitur: halaman tidak ada bila fitur mati bagi pengguna ini. */
export async function gatePage(k: FeatureKey) {
  if (!(await featuresFor(await getCurrentUser()))[k]) notFound();
}

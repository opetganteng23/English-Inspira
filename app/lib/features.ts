import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { getSetting } from "@/models/Settings";

// Saklar fitur yang diatur admin di Settings. Fitur mati = menu, halaman, dan API-nya hilang untuk semua peran.
export const FEATURE_DEFAULTS = { aiCounselor: false };
export type Features = typeof FEATURE_DEFAULTS;

export async function getFeatures(): Promise<Features> {
  await connectDB();
  return getSetting("features", FEATURE_DEFAULTS);
}

/** Dipanggil di awal handler API fitur. Fitur mati dijawab 404 seolah tidak ada. */
export async function requireFeature(k: keyof Features) {
  if (!(await getFeatures())[k]) throw new HttpError(404, "This feature is not available");
}

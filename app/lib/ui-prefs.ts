import { z } from "zod";

// Preferensi tampilan peserta (MTS v2.4 §27.8). Bawaan dipakai bila belum pernah diatur.
const HM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const uiPrefsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  fontSize: z.union([z.literal(16), z.literal(18), z.literal(20), z.literal(22)]),
  reduceMotion: z.boolean(),
  timerDefault: z.enum(["shown", "hidden"]),
  breakReminder: z.boolean(),
  breakMin: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  reminderDigest: z.enum(["daily", "weekly", "important_only"]),
  quietStart: HM,
  quietEnd: HM,
});
export type UiPrefs = z.infer<typeof uiPrefsSchema>;
export const UI_DEFAULTS: UiPrefs = { theme: "system", fontSize: 18, reduceMotion: false, timerDefault: "shown", breakReminder: true, breakMin: 45, reminderDigest: "daily", quietStart: "21:00", quietEnd: "07:00" };

/** Gabungkan nilai tersimpan (bisa sebagian/tidak sah) dengan bawaan. */
export function resolvePrefs(raw: unknown): UiPrefs {
  const out = { ...UI_DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(UI_DEFAULTS) as (keyof UiPrefs)[]) {
      const r = uiPrefsSchema.shape[k].safeParse((raw as Record<string, unknown>)[k]);
      if (r.success) (out as Record<string, unknown>)[k] = r.data;
    }
  }
  return out;
}

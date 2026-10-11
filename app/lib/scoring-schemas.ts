import { z } from "zod";

const sectionTable = z.record(z.string().regex(/^\d{1,3}$/), z.number().int().min(0).max(1000));

/** Masukan profil penilaian (dipakai buat, ubah, dan pratinjau). */
export const profileInput = z.object({
  name: z.string().trim().min(2, "Enter a profile name").max(80),
  description: z.string().trim().max(400).optional(),
  mode: z.enum(["linear", "table"]).default("linear"),
  scaledMin: z.number().int().min(0).max(1000).default(31),
  scaledMax: z.number().int().min(1).max(1000).default(68),
  tables: z.object({ listening: sectionTable.default({}), structure: sectionTable.default({}), reading: sectionTable.default({}) }).default({ listening: {}, structure: {}, reading: {} }),
});

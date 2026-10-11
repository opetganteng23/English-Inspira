import type { Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { getParam } from "./config";
import { scaleSection, estimateTotal, type Conversion, type SectionResult } from "./scoring";
import { ScoringProfile, type ScoringProfileDoc } from "@/models/Scoring";
import type { Section } from "@/models/Question";

export const SECTIONS: Section[] = ["listening", "structure", "reading"];
export const DEFAULT_NAME = "Default (linear estimate)";

type Tables = Record<Section, Record<string, number>>;

/** Dokumen profil -> bentuk Conversion yang dipakai mesin penilaian. */
export function toConversion(p: Pick<ScoringProfileDoc, "mode" | "scaledMin" | "scaledMax" | "tables">): Conversion {
  const t = (m: unknown): Record<string, number> => (m instanceof Map ? Object.fromEntries(m) : ((m as Record<string, number>) ?? {}));
  return { mode: p.mode, scaledMin: p.scaledMin, scaledMax: p.scaledMax, tables: { listening: t(p.tables?.listening), structure: t(p.tables?.structure), reading: t(p.tables?.reading) } } as Conversion;
}

/** Pastikan ada profil bawaan: dibuat dari parameter lama `score_conversion` (linear, belum terverifikasi). */
export async function ensureDefaultProfile() {
  await connectDB();
  const have = await ScoringProfile.findOne({ isDefault: true });
  if (have) return have;
  if ((await ScoringProfile.estimatedDocumentCount()) > 0) {
    const first = await ScoringProfile.findOne({ status: "active" }).sort({ createdAt: 1 });
    if (first) { first.isDefault = true; await first.save(); return first; }
  }
  const legacy = await getParam("score_conversion");
  const doc = await ScoringProfile.findOneAndUpdate(
    { name: DEFAULT_NAME },
    { $setOnInsert: { name: DEFAULT_NAME, description: "Provisional linear conversion. Replace it with a verified table before relying on the scores.", mode: legacy.mode, scaledMin: legacy.scaledMin, scaledMax: legacy.scaledMax, tables: legacy.tables, verified: false, isDefault: true, version: 1 } },
    { upsert: true, new: true }
  );
  return doc!;
}

/** Profil untuk sebuah tes: profil pilihan tes (bila aktif), selain itu profil bawaan. */
export async function profileForTest(test: { scoringProfileId?: Types.ObjectId | null }) {
  await connectDB();
  if (test.scoringProfileId) {
    const p = await ScoringProfile.findOne({ _id: test.scoringProfileId, status: "active" });
    if (p) return p;
  }
  return ensureDefaultProfile();
}

/** Validasi tabel konversi: nilai dalam rentang, tidak menurun saat raw naik, dan tanpa lubang dari 0 sampai raw tertinggi. */
export function validateTables(mode: "linear" | "table", scaledMin: number, scaledMax: number, tables: Tables) {
  const errors: string[] = [], warnings: string[] = [];
  if (scaledMin >= scaledMax) errors.push("The lowest scaled score must be below the highest.");
  if (mode !== "table") return { errors, warnings };
  for (const sec of SECTIONS) {
    const rows = Object.entries(tables[sec] ?? {}).map(([k, v]) => [Number(k), v] as [number, number]).sort((a, b) => a[0] - b[0]);
    if (!rows.length) { errors.push(`${sec}: the table is empty.`); continue; }
    if (rows.some(([r]) => !Number.isInteger(r) || r < 0)) { errors.push(`${sec}: raw scores must be whole numbers from 0.`); continue; }
    for (let i = 0; i < rows.length; i++) {
      const [raw, scaled] = rows[i];
      if (scaled < scaledMin || scaled > scaledMax) errors.push(`${sec}: raw ${raw} maps to ${scaled}, outside ${scaledMin}-${scaledMax}.`);
      if (i > 0 && scaled < rows[i - 1][1]) errors.push(`${sec}: the scaled score drops from raw ${rows[i - 1][0]} to ${raw}.`);
    }
    const missing: number[] = [];
    for (let r = 0; r <= rows[rows.length - 1][0]; r++) if (!(String(r) in tables[sec])) missing.push(r);
    if (missing.length) warnings.push(`${sec}: no value for raw ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}. Missing rows fall back to the linear estimate.`);
    if (rows[0][0] !== 0) warnings.push(`${sec}: the table starts at raw ${rows[0][0]}, not 0.`);
  }
  return { errors, warnings };
}

/** Hitung skor untuk pratinjau: input raw per section (dan jumlah soal), keluaran skala per section dan total. */
export function previewScore(conv: Conversion, input: { section: Section; raw: number; total: number }[]) {
  const sections: SectionResult[] = input.map((s) => ({ section: s.section, raw: s.raw, total: s.total, scaled: scaleSection(conv, s.section, s.raw, s.total) }));
  return { sections, total: estimateTotal(sections) };
}

export function assertEditable(p: ScoringProfileDoc | null) {
  if (!p) throw new HttpError(404, "Scoring profile not found");
  return p;
}

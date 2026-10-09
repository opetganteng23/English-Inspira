import { z } from "zod";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { ConfigParam, Level, type LevelDoc } from "@/models/Config";

// Semua angka di MTS §5 hidup di sini sebagai NILAI BAWAAN, dan dapat ditimpa admin lewat Parameter Sistem (collection config_params).
const sectionTable = z.record(z.string(), z.number());
export const PARAM_SCHEMAS = {
  score_conversion: z.object({
    mode: z.enum(["linear", "table"]), scaledMin: z.number(), scaledMax: z.number(),
    tables: z.object({ listening: sectionTable, structure: sectionTable, reading: sectionTable }),
  }),
  weakness: z.object({ weak: z.number().min(0).max(100), priority: z.number().min(0).max(100), minItems: z.number().int().min(1) }),
  unit_pass_score: z.number().min(0).max(100),
  level_up: z.object({ requireRemedialDone: z.boolean(), minSimScoreFromNextLevel: z.boolean() }),
  booking: z.object({ registerBeforeHours: z.number().min(0), cancelBeforeHours: z.number().min(0) }),
  quota_rules: z.object({ presentUsed: z.boolean(), absentUsed: z.boolean(), excusedOnTimeUsed: z.boolean(), coachCancelUsed: z.boolean() }),
  stuck: z.object({ medianMultiplier: z.number().min(1), minSamples: z.number().int().min(1), consecutiveWrong: z.number().int().min(2) }),
  idle_timeout_sec: z.number().int().min(10),
  plan_deadline_days: z.object({ high: z.number().int().min(1), medium: z.number().int().min(1) }),
  plan_max_active: z.number().int().min(1).max(20),
  alpha: z.number().min(0.05).max(1), // bobot skor baru pada akumulasi topik
  counselor_quota: z.number().int().min(0), // pesan per bulan
  invite_hourly_cap: z.number().int().min(1), // batas email undangan per jam (Gmail ±500/hari)
} as const;
export type ParamKey = keyof typeof PARAM_SCHEMAS;

export const PARAM_DEFAULTS: { [K in ParamKey]: z.infer<(typeof PARAM_SCHEMAS)[K]> } = {
  // PLACEHOLDER: konversi linear. Wajib diganti tabel resmi sebelum produksi (MTS §5/§25 #2).
  score_conversion: { mode: "linear", scaledMin: 31, scaledMax: 68, tables: { listening: {}, structure: {}, reading: {} } },
  weakness: { weak: 60, priority: 40, minItems: 5 },
  unit_pass_score: 70,
  level_up: { requireRemedialDone: true, minSimScoreFromNextLevel: true },
  booking: { registerBeforeHours: 12, cancelBeforeHours: 24 },
  quota_rules: { presentUsed: true, absentUsed: true, excusedOnTimeUsed: false, coachCancelUsed: false },
  stuck: { medianMultiplier: 2, minSamples: 20, consecutiveWrong: 3 },
  idle_timeout_sec: 60,
  plan_deadline_days: { high: 7, medium: 14 },
  plan_max_active: 5,
  alpha: 0.3,
  counselor_quota: 30,
  invite_hourly_cap: 100,
};

export const PARAM_HELP: Record<ParamKey, string> = {
  score_conversion: "Tabel raw → skala 31–68 per section. WAJIB diverifikasi ke sumber resmi sebelum produksi.",
  weakness: "Ambang kelemahan: lemah < 60, prioritas < 40, minimum 5 butir sebelum topik dinilai.",
  unit_pass_score: "Syarat lulus kuis unit (dari bank soal).",
  level_up: "Syarat naik level: skor simulasi ≥ batas bawah level berikutnya dan remedial prioritas tinggi selesai.",
  booking: "Daftar maks N jam sebelum sesi; batal/izin maks N jam sebelum sesi.",
  quota_rules: "Aturan kuota coaching per kehadiran.",
  stuck: "Deteksi stuck: waktu > N× median (min sampel) atau N salah beruntun.",
  idle_timeout_sec: "Waktu tidak aktif yang tidak dihitung (detik).",
  plan_deadline_days: "Deadline otomatis study plan (hari) untuk prioritas tinggi dan sedang.",
  plan_max_active: "Jumlah maksimum item study plan aktif.",
  alpha: "Bobot skor baru pada akumulasi skor topik (0.05–1).",
  counselor_quota: "Batas pesan Konselor AI per bulan per peserta.",
  invite_hourly_cap: "Batas email undangan per jam.",
};

export async function getParam<K extends ParamKey>(key: K): Promise<z.infer<(typeof PARAM_SCHEMAS)[K]>> {
  await connectDB();
  const row = await ConfigParam.findOne({ key }).lean();
  if (!row) return PARAM_DEFAULTS[key];
  const parsed = PARAM_SCHEMAS[key].safeParse(row.value);
  return (parsed.success ? parsed.data : PARAM_DEFAULTS[key]) as z.infer<(typeof PARAM_SCHEMAS)[K]>; // nilai rusak → kembali ke bawaan
}

export async function getAllParams() {
  await connectDB();
  const rows = new Map((await ConfigParam.find().lean()).map((r) => [r.key, r.value]));
  return (Object.keys(PARAM_SCHEMAS) as ParamKey[]).map((key) => ({ key, help: PARAM_HELP[key], value: rows.has(key) ? rows.get(key) : PARAM_DEFAULTS[key], isDefault: !rows.has(key), default: PARAM_DEFAULTS[key] }));
}

export async function setParam(key: ParamKey, value: unknown, by: Types.ObjectId | string) {
  const v = PARAM_SCHEMAS[key].parse(value);
  await connectDB();
  await ConfigParam.updateOne({ key }, { value: v, updatedBy: by }, { upsert: true });
}

// ---------- Level ----------
export const LEVEL_DEFAULTS = [
  // PLACEHOLDER (MTS §5): ditetapkan pihak yang meminta.
  { key: "basic", name: "Basic", order: 1, scoreMin: 310, scoreMax: 459, coachingQuota: 8 },
  { key: "intermediate", name: "Intermediate", order: 2, scoreMin: 460, scoreMax: 542, coachingQuota: 4 },
  { key: "advanced", name: "Advanced", order: 3, scoreMin: 543, scoreMax: 677, coachingQuota: 2 },
];

/** Daftar level terurut. Bila koleksi kosong, diisi nilai bawaan (sekali). */
export async function getLevels() {
  await connectDB();
  let list = await Level.find().sort({ order: 1 }).lean();
  if (!list.length) {
    await Level.insertMany(LEVEL_DEFAULTS, { ordered: false }).catch(() => {});
    list = await Level.find().sort({ order: 1 }).lean();
  }
  return list;
}

export function levelForScore<T extends Pick<LevelDoc, "scoreMin" | "scoreMax" | "order">>(levels: T[], score: number): T | undefined {
  const s = Math.round(score);
  const exact = levels.find((l) => s >= l.scoreMin && s <= l.scoreMax);
  if (exact) return exact;
  // Skor di celah/di luar rentang: pakai level terdekat.
  return [...levels].sort((a, b) => Math.min(Math.abs(s - a.scoreMin), Math.abs(s - a.scoreMax)) - Math.min(Math.abs(s - b.scoreMin), Math.abs(s - b.scoreMax)))[0];
}

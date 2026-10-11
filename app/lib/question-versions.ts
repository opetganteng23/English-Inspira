import mongoose, { Schema, type Types, type Model } from "mongoose";
import { connectDB } from "./db";

// Riwayat versi soal: tiap pembuatan, perubahan, dan pemulihan menyimpan salinan lengkap + daftar kolom yang berubah.
const versionSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true },
    snapshot: Schema.Types.Mixed,
    changed: [String],
    note: String,
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
versionSchema.index({ questionId: 1, version: -1 }, { unique: true });
type VersionDoc = { questionId: Types.ObjectId; version: number; snapshot: Snapshot; changed: string[]; note?: string; actorId?: Types.ObjectId; at: Date };
export const QuestionVersion: Model<VersionDoc> = (mongoose.models.QuestionVersion as Model<VersionDoc>) || mongoose.model<VersionDoc>("QuestionVersion", versionSchema);

export const FIELDS = ["section", "type", "groupId", "stem", "options", "answerKey", "explanation", "tags", "difficulty", "status", "source", "assetIds"] as const;
export type Snapshot = Record<(typeof FIELDS)[number], unknown>;

type QLike = Partial<Record<(typeof FIELDS)[number], unknown>>;

/** Ambil kolom yang relevan dalam bentuk yang stabil (id menjadi string) sehingga bisa dibandingkan dan disimpan. */
export function snapshotOf(q: QLike): Snapshot {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object" && "_bsontype" in (v as object)) return String(v);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => k !== "_id").map(([k, x]) => [k, norm(x)]));
    return v ?? null;
  };
  return Object.fromEntries(FIELDS.map((f) => [f, norm(q[f])])) as Snapshot;
}

/** Catat versi baru. `changed` dihitung terhadap versi sebelumnya (versi 1 = "created"). Tidak pernah menggagalkan penyimpanan soal. */
export async function recordQuestionVersion(questionId: Types.ObjectId | string, q: QLike, actorId?: Types.ObjectId | string, note?: string) {
  try {
    await connectDB();
    const snap = snapshotOf(q);
    const last = await QuestionVersion.findOne({ questionId }).sort({ version: -1 }).lean();
    const changed = last ? FIELDS.filter((f) => JSON.stringify(last.snapshot[f]) !== JSON.stringify(snap[f])) : [];
    if (last && changed.length === 0 && !note) return null; // tidak ada perubahan nyata
    const v = await QuestionVersion.create({ questionId, version: (last?.version ?? 0) + 1, snapshot: snap, changed: last ? changed : ["created"], note, actorId });
    return { version: v.version, changed: v.changed };
  } catch (e) {
    console.error("[question-version]", e);
    return null;
  }
}

/** Soal lama belum punya riwayat: simpan kondisi SEBELUM perubahan pertama sebagai versi dasar agar bisa dibandingkan dan dipulihkan. */
export async function ensureBaseline(questionId: Types.ObjectId | string, q: QLike) {
  await connectDB();
  if (await QuestionVersion.exists({ questionId })) return;
  await recordQuestionVersion(questionId, q, undefined, "Baseline before the first tracked edit");
}

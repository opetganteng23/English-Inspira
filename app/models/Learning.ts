import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Statistik akumulatif per peserta per topik (MTS §13.2). Diperbarui setiap pengerjaan selesai.
const topicStatSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    skill: { type: String, required: true },
    topic: { type: String, required: true },
    score: { type: Number, required: true }, // 0–100, rata-rata tertimbang (alpha)
    items: { type: Number, default: 0 }, // jumlah butir soal yang sudah dinilai
    status: { type: String, enum: ["strong", "ok", "weak", "priority", "insufficient"], required: true },
    lastAttemptId: { type: Schema.Types.ObjectId, ref: "Attempt" },
  },
  { timestamps: true }
);
topicStatSchema.index({ userId: 1, skill: 1, topic: 1 }, { unique: true });
export type TopicStatDoc = InferSchemaType<typeof topicStatSchema> & { _id: mongoose.Types.ObjectId };
export const TopicStat: Model<TopicStatDoc> = (mongoose.models.TopicStat as Model<TopicStatDoc>) || mongoose.model<TopicStatDoc>("TopicStat", topicStatSchema);

// Rencana belajar (MTS §15). `source` auto dibuat sistem; item coach tidak ditimpa sistem.
const planItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    skill: String,
    topic: String,
    title: { type: String, required: true },
    priority: { type: String, enum: ["high", "medium"], required: true },
    source: { type: String, enum: ["auto", "coach"], default: "auto" },
    status: { type: String, enum: ["active", "late", "done", "resolved", "expired"], default: "active" }, // late = lewat deadline tetapi masih bisa dikerjakan; resolved = topik membaik tanpa dicentang
    dueAt: Date,
    doneAt: Date,
    remindedAt: Date, // pengingat H-2 deadline sudah dikirim
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" }, // unit remedial (remedial_map)
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis" },
  },
  { timestamps: true }
);
planItemSchema.index({ userId: 1, status: 1 });
export type PlanItemDoc = InferSchemaType<typeof planItemSchema> & { _id: mongoose.Types.ObjectId };
export const PlanItem: Model<PlanItemDoc> = (mongoose.models.PlanItem as Model<PlanItemDoc>) || mongoose.model<PlanItemDoc>("PlanItem", planItemSchema);

// Hasil analisis (MTS §13.3): dibuat tiap pengerjaan selesai. `calculated` = angka dari kode, `ready` = narasi sudah ada.
const analysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    sourceKind: { type: String, enum: ["placement", "sim", "practice", "quiz", "pdf"], required: true },
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt", index: true },
    pdfId: { type: Schema.Types.ObjectId, ref: "PdfImport", index: true },
    status: { type: String, enum: ["calculated", "ready", "failed"], default: "calculated" },
    calculated: Schema.Types.Mixed, // topik + status, stuck; tanpa PII
    narrative: Schema.Types.Mixed, // keluaran AI/template yang sudah divalidasi
    mock: Boolean, // true bila narasi dari template (bukan Claude)
    engine: { type: String, enum: ["claude", "template"] },
    model: String,
    promptVersion: String,
    tokensIn: Number,
    tokensOut: Number,
    inputHash: { type: String, index: true },
    fallbackReason: String, // api_error | invalid_output | rate_limited | no_key | light_kind
    retries: { type: Number, default: 0 },
    claimedAt: Date, // klaim atomik agar tidak ada dua panggilan AI untuk satu hasil
  },
  { timestamps: true }
);
export type AnalysisDoc = InferSchemaType<typeof analysisSchema> & { _id: mongoose.Types.ObjectId };
export const Analysis: Model<AnalysisDoc> = (mongoose.models.Analysis as Model<AnalysisDoc>) || mongoose.model<AnalysisDoc>("Analysis", analysisSchema);

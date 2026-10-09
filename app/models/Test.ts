import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { SECTIONS } from "./Question";

// Jenis tes (MTS §11): placement (sekali), sim (simulasi berkala), practice (latihan bebas ulang), quiz (penilaian unit, dinilai server).
export const TEST_KINDS = ["placement", "sim", "practice", "quiz"] as const;

const testSchema = new Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: TEST_KINDS, required: true, index: true },
    levelId: { type: Schema.Types.ObjectId, ref: "Level" }, // kosong = untuk semua level
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" }, // kuis milik unit
    sections: [
      {
        _id: false,
        name: { type: String, enum: SECTIONS, required: true },
        durationSec: { type: Number, required: true },
        questionIds: [{ type: Schema.Types.ObjectId, ref: "Question" }],
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const attemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    kind: String, // salinan Test.kind
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    // Timer dipegang server: section aktif dan kapan ia dimulai.
    sectionIdx: { type: Number, default: 0 },
    sectionStartedAt: { type: Date, required: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    // firstChoice = pilihan pertama, changes = berapa kali jawaban diganti (indikator ragu-ragu)
    answers: [{ _id: false, qid: Schema.Types.ObjectId, firstChoice: Number, choice: Number, changes: { type: Number, default: 0 }, timeSpentSec: Number, flagged: Boolean }],
    scoreRaw: Number,
    scoreEst: Number,
    sectionScores: [{ _id: false, section: String, raw: Number, total: Number, scaled: Number }],
    topicScores: [{ _id: false, skill: String, topic: String, correct: Number, total: Number, score: Number }],
    proctorFlags: [{ _id: false, kind: String, at: Date }],
    audioPlays: [{ _id: false, audioId: Schema.Types.ObjectId, playedAt: Date, lastPosSec: Number, done: Boolean }],
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis" },
    aiAnalysis: Schema.Types.Mixed, // sementara; dipindah ke koleksi analyses pada Fase 5
    proctorReview: { status: { type: String, enum: ["clean", "suspicious", "invalid"] }, note: String, at: Date, by: Schema.Types.ObjectId },
  },
  { timestamps: true }
);
attemptSchema.index({ userId: 1, kind: 1 });

export type TestDoc = InferSchemaType<typeof testSchema> & { _id: mongoose.Types.ObjectId };
export type AttemptDoc = InferSchemaType<typeof attemptSchema> & { _id: mongoose.Types.ObjectId };
export const Test: Model<TestDoc> =
  (mongoose.models.Test as Model<TestDoc>) || mongoose.model<TestDoc>("Test", testSchema);
export const Attempt: Model<AttemptDoc> =
  (mongoose.models.Attempt as Model<AttemptDoc>) || mongoose.model<AttemptDoc>("Attempt", attemptSchema);

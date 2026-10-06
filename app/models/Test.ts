import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { SECTIONS } from "./Question";

const testSchema = new Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: ["trial", "diagnostic", "prediction", "sim"], required: true, index: true },
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
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    kind: String, // salinan Test.kind agar query "1 trial per akun" murah
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    // Timer dipegang server: section aktif dan kapan ia dimulai.
    sectionIdx: { type: Number, default: 0 },
    sectionStartedAt: { type: Date, required: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    answers: [{ _id: false, qid: Schema.Types.ObjectId, choice: Number, timeSpentSec: Number, flagged: Boolean }],
    scoreRaw: Number,
    scoreEst: Number,
    sectionScores: [{ _id: false, section: String, raw: Number, total: Number, scaled: Number }],
    proctorFlags: [{ _id: false, kind: String, at: Date }],
    audioPlays: [{ _id: false, audioId: Schema.Types.ObjectId, playedAt: Date, lastPosSec: Number, done: Boolean }],
    aiAnalysis: Schema.Types.Mixed,
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

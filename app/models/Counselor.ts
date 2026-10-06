import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const threadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt" },
    title: String,
    messages: [{ _id: false, role: { type: String, enum: ["user", "assistant"] }, content: String, at: Date, mock: Boolean }],
    actionPlan: [{ text: String, done: { type: Boolean, default: false }, dueAt: Date, remindedAt: Date }],
    reviewed: { type: Boolean, default: false, index: true },
    flagged: { type: Boolean, default: false, index: true },
    reviewNote: String,
    helpful: { type: Boolean }, // penilaian peserta (opsional)
  },
  { timestamps: true }
);
export type ThreadDoc = InferSchemaType<typeof threadSchema> & { _id: mongoose.Types.ObjectId };
export const CounselorThread: Model<ThreadDoc> =
  (mongoose.models.CounselorThread as Model<ThreadDoc>) || mongoose.model<ThreadDoc>("CounselorThread", threadSchema);

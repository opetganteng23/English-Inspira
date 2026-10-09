import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

export const SECTIONS = ["listening", "structure", "reading"] as const;
export type Section = (typeof SECTIONS)[number];

const questionSchema = new Schema(
  {
    section: { type: String, enum: SECTIONS, required: true, index: true },
    type: { type: String, required: true }, // mis. subject-verb, inference, detail
    groupId: { type: Schema.Types.ObjectId, ref: "QuestionGroup", index: true }, // audio/passage bersama
    stem: { type: String, required: true },
    options: { type: [String], validate: (v: string[]) => v.length >= 2 && v.length <= 6 },
    answerKey: { type: Number, required: true }, // indeks pada options
    explanation: String,
    // Tag DUA TINGKAT wajib (MTS §6): skill (mis. grammar) + topic (mis. subject-verb). Dasar topic_stats & remedial_map.
    tags: [{ _id: false, skill: { type: String, required: true, trim: true }, topic: { type: String, required: true, trim: true } }],
    assetIds: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    status: { type: String, enum: ["draft", "review", "published"], default: "draft", index: true },
  },
  { timestamps: true }
);

// Satu audio/passage dipakai beberapa soal.
const groupSchema = new Schema(
  {
    section: { type: String, enum: SECTIONS, required: true },
    instruction: String,
    audioId: { type: Schema.Types.ObjectId, ref: "Audio" },
    passageTitle: String,
    passageHtml: String, // sudah disanitasi
    assetIds: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
  },
  { timestamps: true }
);

export type QuestionDoc = InferSchemaType<typeof questionSchema> & { _id: mongoose.Types.ObjectId };
export type GroupDoc = InferSchemaType<typeof groupSchema> & { _id: mongoose.Types.ObjectId };
export const Question: Model<QuestionDoc> =
  (mongoose.models.Question as Model<QuestionDoc>) || mongoose.model<QuestionDoc>("Question", questionSchema);
export const QuestionGroup: Model<GroupDoc> =
  (mongoose.models.QuestionGroup as Model<GroupDoc>) || mongoose.model<GroupDoc>("QuestionGroup", groupSchema);

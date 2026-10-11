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
    status: { type: String, enum: ["draft", "review", "published", "archived"], default: "draft", index: true },
    source: { type: String, trim: true, maxlength: 200 }, // sumber dan status izin penggunaan
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

// Jenis soal yang dikelola admin per kategori (section), mis. "Short conversations (Part A)" atau "Inference".
// Soal menyimpan nama jenis di `type`; mengganti nama jenis ikut mengubah soalnya.
const typeSchema = new Schema(
  {
    section: { type: String, enum: SECTIONS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
typeSchema.index({ section: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
export type QuestionTypeDoc = InferSchemaType<typeof typeSchema> & { _id: mongoose.Types.ObjectId };
export const QuestionType: Model<QuestionTypeDoc> =
  (mongoose.models.QuestionType as Model<QuestionTypeDoc>) || mongoose.model<QuestionTypeDoc>("QuestionType", typeSchema);

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Level → Course → Unit (MTS §10.1). Course milik satu level; peserta hanya melihat course levelnya.
const courseSchema = new Schema(
  {
    levelId: { type: Schema.Types.ObjectId, ref: "Level", required: true, index: true },
    title: { type: String, required: true },
    description: String,
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unit selesai bila semua `materialIds` selesai DAN (bila ada) kuisnya lulus (`unit_pass_score`).
const unitSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true },
    description: String,
    order: { type: Number, default: 0 },
    materialIds: [{ type: Schema.Types.ObjectId, ref: "Material" }],
    quizTestId: { type: Schema.Types.ObjectId, ref: "Test" }, // Test.kind = quiz
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const unitProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    materialsDone: [{ type: Schema.Types.ObjectId, ref: "Material" }],
    quizBest: Number, // persen benar terbaik (0–100)
    quizPassed: { type: Boolean, default: false },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    completedAt: Date,
  },
  { timestamps: true }
);
unitProgressSchema.index({ userId: 1, unitId: 1 }, { unique: true });

// Waktu belajar aktif per hari (MTS §13.1). Hanya detik aktif yang dihitung; idle tidak.
const learningEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    kind: { type: String, enum: ["material", "unit"], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    day: { type: String, required: true }, // YYYY-MM-DD (WIB)
    activeSec: { type: Number, default: 0 },
  },
  { timestamps: true }
);
learningEventSchema.index({ userId: 1, kind: 1, refId: 1, day: 1 }, { unique: true });

// Peta remedial (MTS §6): topik lemah → unit yang memperbaikinya. Dipakai study plan untuk menautkan item ke unit.
const remedialSchema = new Schema(
  { skill: { type: String, required: true }, topic: { type: String, required: true }, unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true } },
  { timestamps: true }
);
remedialSchema.index({ skill: 1, topic: 1, unitId: 1 }, { unique: true });

export type CourseDoc = InferSchemaType<typeof courseSchema> & { _id: mongoose.Types.ObjectId };
export type UnitDoc = InferSchemaType<typeof unitSchema> & { _id: mongoose.Types.ObjectId };
export const Course: Model<CourseDoc> = (mongoose.models.Course as Model<CourseDoc>) || mongoose.model<CourseDoc>("Course", courseSchema);
export const Unit: Model<UnitDoc> = (mongoose.models.Unit as Model<UnitDoc>) || mongoose.model<UnitDoc>("Unit", unitSchema);
export const UnitProgress = (mongoose.models.UnitProgress as Model<InferSchemaType<typeof unitProgressSchema>>) || mongoose.model("UnitProgress", unitProgressSchema);
export const RemedialMap = (mongoose.models.RemedialMap as Model<InferSchemaType<typeof remedialSchema>>) || mongoose.model("RemedialMap", remedialSchema);
export const LearningEvent = (mongoose.models.LearningEvent as Model<InferSchemaType<typeof learningEventSchema>>) || mongoose.model("LearningEvent", learningEventSchema);

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Hasil tes luar (PURE/OCE) yang diunggah admin lalu dicocokkan ke peserta berdasarkan nama.
// Skor asli disimpan apa adanya; `itpScore` = padanan skala TOEFL ITP (310-677) yang dipakai untuk level dan kelas.
const resultSchema = new Schema(
  {
    batchId: { type: String, required: true, index: true },
    source: { type: String, enum: ["pure", "oce"], required: true },
    rawName: { type: String, required: true, trim: true },
    rawEmail: { type: String, trim: true, lowercase: true },
    score: { type: Number }, // skor asli pada skala sumbernya
    itpScore: Number, // padanan TOEFL ITP
    testDate: Date,
    fileName: String,
    fileId: { type: Schema.Types.ObjectId }, // PDF asli di GridFS bucket `pdf`
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    matchConfidence: { type: Number, default: 0 }, // 0-1
    candidates: [{ _id: false, userId: { type: Schema.Types.ObjectId, ref: "User" }, name: String, email: String, confidence: Number }],
    status: { type: String, enum: ["pending", "confirmed", "skipped"], default: "pending", index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedAt: Date,
    programCycleId: { type: Schema.Types.ObjectId, ref: "ProgramCycle" },
  },
  { timestamps: true }
);

// Kelas: satu kelompok kemampuan (level) bisa punya beberapa kelas berkapasitas dan ber-coach.
const classSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    levelId: { type: Schema.Types.ObjectId, ref: "Level", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true }, // kosong = lintas institusi
    programCycleId: { type: Schema.Types.ObjectId, ref: "ProgramCycle", index: true }, // kosong = tanpa periode
    capacity: { type: Number, required: true, min: 1 },
    coachId: { type: Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Keanggotaan kelas. Satu peserta hanya di satu kelas aktif; riwayat pindah tetap tersimpan (active=false).
const memberSchema = new Schema(
  {
    classId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    method: { type: String, enum: ["auto", "manual"], required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
    leftAt: Date,
  },
  { timestamps: true }
);
memberSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { active: true } });

export type ExternalResultDoc = InferSchemaType<typeof resultSchema> & { _id: mongoose.Types.ObjectId };
export type ClassDoc = InferSchemaType<typeof classSchema> & { _id: mongoose.Types.ObjectId };
export const ExternalResult: Model<ExternalResultDoc> = (mongoose.models.ExternalResult as Model<ExternalResultDoc>) || mongoose.model<ExternalResultDoc>("ExternalResult", resultSchema);
export const ClassGroup: Model<ClassDoc> = (mongoose.models.ClassGroup as Model<ClassDoc>) || mongoose.model<ClassDoc>("ClassGroup", classSchema);
export const ClassMember = (mongoose.models.ClassMember as Model<InferSchemaType<typeof memberSchema>>) || mongoose.model("ClassMember", memberSchema);

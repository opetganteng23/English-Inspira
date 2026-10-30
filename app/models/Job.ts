import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Pekerjaan latar yang dijalankan admin dari UI (Sesi 6): narasi AI per peserta, laporan Excel/PowerPoint besar.
// Berjalan di proses aplikasi; bila aplikasi dimulai ulang di tengah jalan, pekerjaan tertinggal ditandai "interrupted" dan bisa diulang.
export const JOB_KINDS = ["narratives", "xlsx", "pptx"] as const;

const jobSchema = new Schema(
  {
    kind: { type: String, enum: JOB_KINDS, required: true },
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution" },
    label: String, // nama tes (dan institusi) untuk daftar
    status: { type: String, enum: ["running", "done", "failed"], default: "running", index: true },
    total: { type: Number, default: 0 },
    done: { type: Number, default: 0 },
    ai: { type: Number, default: 0 }, // narasi: berapa yang ditulis AI (sisanya template)
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    message: String,
    fileId: Schema.Types.ObjectId, // laporan jadi (GridFS "reports"), dihapus setelah 7 hari
    fileName: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    heartbeatAt: Date,
    finishedAt: Date,
  },
  { timestamps: true }
);

export type JobDoc = InferSchemaType<typeof jobSchema> & { _id: mongoose.Types.ObjectId };
export const Job: Model<JobDoc> = (mongoose.models.Job as Model<JobDoc>) || mongoose.model<JobDoc>("Job", jobSchema);

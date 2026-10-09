import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Impor hasil dari PDF luar (MTS §14, pintu 2). File asli di GridFS bucket `pdf`; HANYA nilai terverifikasi yang dipakai analisis.
const scores = { listening: Number, structure: Number, reading: Number, total: Number };
const pdfSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    fileId: { type: Schema.Types.ObjectId }, // dihapus oleh job retensi; angka terverifikasi tetap
    filename: String,
    size: Number,
    status: { type: String, enum: ["uploaded", "extracted", "verified", "analyzed"], default: "uploaded" },
    template: String, // format PDF yang dikenali parser
    parsed: scores, // hasil baca otomatis (bisa salah)
    verified: scores, // nilai yang dikonfirmasi/dikoreksi peserta
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis" },
    expiresAt: { type: Date, index: true }, // retensi file
  },
  { timestamps: true }
);
export type PdfDoc = InferSchemaType<typeof pdfSchema> & { _id: mongoose.Types.ObjectId };
export const PdfImport: Model<PdfDoc> = (mongoose.models.PdfImport as Model<PdfDoc>) || mongoose.model<PdfDoc>("PdfImport", pdfSchema);

export async function pdfBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "pdf" });
}

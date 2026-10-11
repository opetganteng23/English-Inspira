import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const sectionTable = { type: Map, of: Number, default: {} }; // raw (teks) -> skala section

// Profil penilaian: aturan konversi skor mentah ke skala section dan total. Tes memilih satu profil;
// tiap percobaan menyimpan profil dan versinya sehingga hasil lama tetap bisa ditelusuri.
const profileSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
    description: { type: String, trim: true, maxlength: 400 },
    version: { type: Number, default: 1 }, // naik setiap aturan konversi diubah
    mode: { type: String, enum: ["linear", "table"], default: "linear" },
    scaledMin: { type: Number, default: 31 },
    scaledMax: { type: Number, default: 68 },
    tables: { listening: sectionTable, structure: sectionTable, reading: sectionTable },
    // Verifikasi: tabel diakui sesuai sumber yang sah dan versi tes yang disimulasikan. Tanpa ini skor berlabel estimasi.
    verified: { type: Boolean, default: false },
    source: { type: String, trim: true, maxlength: 300 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);

export type ScoringProfileDoc = InferSchemaType<typeof profileSchema> & { _id: mongoose.Types.ObjectId };
export const ScoringProfile: Model<ScoringProfileDoc> =
  (mongoose.models.ScoringProfile as Model<ScoringProfileDoc>) || mongoose.model<ScoringProfileDoc>("ScoringProfile", profileSchema);

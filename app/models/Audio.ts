import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Metadata audio; biner ada di GridFS bucket "audio".
const audioSchema = new Schema(
  {
    gridFsId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, trim: true },
    mime: { type: String, default: "audio/mpeg" },
    size: { type: Number, required: true },
    durationSec: { type: Number, required: true },
    sha256: { type: String, index: { unique: true, sparse: true } },
    transcript: String, // hanya admin; peserta melihatnya setelah tes selesai
    uploaderId: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);

export type AudioDoc = InferSchemaType<typeof audioSchema>;
export const Audio: Model<AudioDoc> =
  (mongoose.models.Audio as Model<AudioDoc>) || mongoose.model<AudioDoc>("Audio", audioSchema);

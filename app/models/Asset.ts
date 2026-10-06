import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Gambar base64. Jangan pernah find() tanpa .select("-dataBase64") pada listing.
const assetSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    mime: { type: String, enum: ["image/jpeg", "image/png", "image/webp", "image/gif"], required: true },
    size: { type: Number, required: true },
    width: Number,
    height: Number,
    dataBase64: { type: String, required: true },
    sha256: { type: String, index: { unique: true, sparse: true } },
    sensitive: { type: Boolean, default: false }, // KTP/pas foto: hanya pemilik + admin
  },
  { timestamps: true }
);

export type AssetDoc = InferSchemaType<typeof assetSchema>;
export const Asset: Model<AssetDoc> =
  (mongoose.models.Asset as Model<AssetDoc>) || mongoose.model<AssetDoc>("Asset", assetSchema);

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const institutionSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    seats: { type: Number, default: 0 },
    seatsUsed: { type: Number, default: 0 },
    contactEmail: String,
    batch: String, // mis. "Batch 2026"
    productId: { type: Schema.Types.ObjectId, ref: "Product" }, // akses yang diberikan ke anggota
    validUntil: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type InstitutionDoc = InferSchemaType<typeof institutionSchema> & { _id: mongoose.Types.ObjectId };
export const Institution: Model<InstitutionDoc> =
  (mongoose.models.Institution as Model<InstitutionDoc>) ||
  mongoose.model<InstitutionDoc>("Institution", institutionSchema);

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const institutionSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    seats: { type: Number, default: 0 },
    contactEmail: String,
  },
  { timestamps: true }
);

export type InstitutionDoc = InferSchemaType<typeof institutionSchema>;
export const Institution: Model<InstitutionDoc> =
  (mongoose.models.Institution as Model<InstitutionDoc>) ||
  mongoose.model<InstitutionDoc>("Institution", institutionSchema);

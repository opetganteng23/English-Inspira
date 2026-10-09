import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const institutionSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    seats: { type: Number, default: 0 },
    seatsUsed: { type: Number, default: 0 },
    contractStart: Date,
    contractEnd: Date, // enrollment peserta berakhir di sini
    contactEmail: String,
    batch: String,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    configOverrides: Schema.Types.Mixed, // disiapkan, TIDAK dipakai di v2 (MTS §5)
  },
  { timestamps: true }
);

export type InstitutionDoc = InferSchemaType<typeof institutionSchema> & { _id: mongoose.Types.ObjectId };
export const Institution: Model<InstitutionDoc> =
  (mongoose.models.Institution as Model<InstitutionDoc>) ||
  mongoose.model<InstitutionDoc>("Institution", institutionSchema);

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const otpSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

export type OtpDoc = InferSchemaType<typeof otpSchema>;
export const Otp: Model<OtpDoc> =
  (mongoose.models.Otp as Model<OtpDoc>) || mongoose.model<OtpDoc>("Otp", otpSchema);

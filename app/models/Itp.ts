import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const sessionSchema = new Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    place: { type: String, required: true },
    organizer: String,
    quota: { type: Number, required: true, min: 1 },
    registered: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "closed", "done"], default: "open" },
  },
  { timestamps: true }
);

const registrationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "ItpSession", required: true, index: true },
    entitlementId: { type: Schema.Types.ObjectId, ref: "Entitlement" },
    fullName: { type: String, required: true },
    nikEnc: { type: String, required: true }, // AES-256-GCM
    nikLast4: String,
    birthDate: { type: Date, required: true },
    gender: { type: String, enum: ["L", "P"], required: true },
    idPhotoAssetId: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    facePhotoAssetId: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    status: { type: String, enum: ["submitted", "confirmed", "done", "cancelled"], default: "submitted" },
    docStatus: { type: String, enum: ["pending", "valid", "rejected"], default: "pending" },
    docNote: String,
    score: { listening: Number, structure: Number, reading: Number, total: Number },
    certificateId: { type: Schema.Types.ObjectId, ref: "Certificate" },
  },
  { timestamps: true }
);
registrationSchema.index({ sessionId: 1, status: 1 });

const certificateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["itp", "sim_report"], required: true },
    number: { type: String, required: true, unique: true },
    data: Schema.Types.Mixed,
    registrationId: { type: Schema.Types.ObjectId, ref: "ItpRegistration" },
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt" },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: mongoose.Types.ObjectId };
export type RegistrationDoc = InferSchemaType<typeof registrationSchema> & { _id: mongoose.Types.ObjectId };
export type CertificateDoc = InferSchemaType<typeof certificateSchema> & { _id: mongoose.Types.ObjectId };
export const ItpSession: Model<SessionDoc> = (mongoose.models.ItpSession as Model<SessionDoc>) || mongoose.model<SessionDoc>("ItpSession", sessionSchema);
export const ItpRegistration: Model<RegistrationDoc> = (mongoose.models.ItpRegistration as Model<RegistrationDoc>) || mongoose.model<RegistrationDoc>("ItpRegistration", registrationSchema);
export const Certificate: Model<CertificateDoc> = (mongoose.models.Certificate as Model<CertificateDoc>) || mongoose.model<CertificateDoc>("Certificate", certificateSchema);

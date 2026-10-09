import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// ---- Enrollment: sumber kebenaran akses (MTS §6) ----
const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true },
    status: { type: String, enum: ["active", "expired", "disabled"], default: "active" },
    startsAt: { type: Date, default: Date.now },
    expiresAt: Date, // = contractEnd institusi; kosong = tanpa batas
  },
  { timestamps: true }
);
enrollmentSchema.index({ userId: 1, status: 1 });
export type EnrollmentDoc = InferSchemaType<typeof enrollmentSchema> & { _id: mongoose.Types.ObjectId };
export const Enrollment: Model<EnrollmentDoc> = (mongoose.models.Enrollment as Model<EnrollmentDoc>) || mongoose.model<EnrollmentDoc>("Enrollment", enrollmentSchema);

// ---- Undangan: token berumur 7 hari (disimpan sebagai hash) ----
const invitationSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "used", "revoked"], default: "pending" },
  },
  { timestamps: true }
);
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 * 30 }); // bersihkan 30 hari setelah kedaluwarsa
export type InvitationDoc = InferSchemaType<typeof invitationSchema> & { _id: mongoose.Types.ObjectId };
export const Invitation: Model<InvitationDoc> = (mongoose.models.Invitation as Model<InvitationDoc>) || mongoose.model<InvitationDoc>("Invitation", invitationSchema);

// ---- Antrean email (MTS §7): semua email lewat sini ----
const mailSchema = new Schema(
  {
    to: { type: String, required: true },
    template: { type: String, required: true, index: true },
    data: Schema.Types.Mixed,
    status: { type: String, enum: ["queued", "sending", "sent", "failed"], default: "queued", index: true },
    priority: { type: Number, default: 5 }, // kecil = lebih dulu (OTP = 1)
    tries: { type: Number, default: 0 },
    nextTryAt: { type: Date, default: Date.now, index: true },
    lastError: String,
    sentAt: Date,
  },
  { timestamps: true }
);
export type MailDoc = InferSchemaType<typeof mailSchema> & { _id: mongoose.Types.ObjectId };
export const MailJob: Model<MailDoc> = (mongoose.models.MailJob as Model<MailDoc>) || mongoose.model<MailDoc>("MailJob", mailSchema);

// ---- Notifikasi dalam aplikasi ----
const notifSchema = new Schema(
  { userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, type: { type: String, required: true }, payload: Schema.Types.Mixed, readAt: Date },
  { timestamps: true }
);
export const Notification = (mongoose.models.Notification as Model<InferSchemaType<typeof notifSchema>>) || mongoose.model("Notification", notifSchema);

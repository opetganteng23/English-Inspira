import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

export const ROLES = ["participant", "coach", "inst_admin", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const USER_STATUS = ["invited", "active", "disabled"] as const;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    phone: String,
    role: { type: String, enum: ROLES, default: "participant", index: true },
    // Wajib untuk participant/coach/inst_admin; hanya admin tanpa institusi (ditegakkan di lib/participants.ts).
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    status: { type: String, enum: USER_STATUS, default: "invited", index: true },
    consentAt: Date,
    lastLoginAt: Date,
    // Level & placement (MTS §12)
    currentLevelId: { type: Schema.Types.ObjectId, ref: "Level" },
    currentScoreEst: Number,
    placementAttemptId: { type: Schema.Types.ObjectId, ref: "Attempt" },
    placementRetakeAllowed: { type: Boolean, default: false }, // diizinkan admin/coach
    levelHistory: [{ _id: false, levelId: { type: Schema.Types.ObjectId, ref: "Level" }, at: Date, reason: String }],
    // Profil opsional
    nik: String,
    birthDate: Date,
    gender: { type: String, enum: ["L", "P"] },
    targetScore: Number,
    goal: { type: String, enum: ["kelulusan", "beasiswa", "pekerjaan", "lainnya"] },
    education: { type: String, enum: ["sma", "d3", "s1", "s2"] },
    deletedAt: Date,
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);

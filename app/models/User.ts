import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

export const ROLES = ["participant", "admin", "inst_admin"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    phone: String,
    role: { type: String, enum: ROLES, default: "participant", index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    nik: String,
    birthDate: Date,
    gender: { type: String, enum: ["L", "P"] },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    targetScore: { type: Number, enum: [450, 500, 550, 600] },
    goal: { type: String, enum: ["kelulusan", "beasiswa", "pekerjaan", "lainnya"] },
    education: { type: String, enum: ["sma", "d3", "s1", "s2"] },
    referralCode: String,
    consentAt: Date,
    deletedAt: Date,
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);

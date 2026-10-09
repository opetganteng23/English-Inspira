import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Level & parameter dikelola admin lewat Parameter Sistem; tidak ditulis mati di kode (MTS §5).
const levelSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // basic | intermediate | advanced
    name: { type: String, required: true },
    order: { type: Number, required: true },
    scoreMin: { type: Number, required: true },
    scoreMax: { type: Number, required: true },
    coachingQuota: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
export type LevelDoc = InferSchemaType<typeof levelSchema> & { _id: mongoose.Types.ObjectId };
export const Level: Model<LevelDoc> = (mongoose.models.Level as Model<LevelDoc>) || mongoose.model<LevelDoc>("Level", levelSchema);

const paramSchema = new Schema({ key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed, updatedBy: { type: Schema.Types.ObjectId, ref: "User" } }, { timestamps: true });
export const ConfigParam = (mongoose.models.ConfigParam as Model<{ key: string; value: unknown; updatedBy?: mongoose.Types.ObjectId }>) || mongoose.model("ConfigParam", paramSchema);

const quotaSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true },
    levelId: { type: Schema.Types.ObjectId, ref: "Level", required: true },
    total: { type: Number, required: true },
    used: { type: Number, default: 0 },
    active: { type: Boolean, default: true }, // kuota level lama dinonaktifkan saat naik level
  },
  { timestamps: true }
);
quotaSchema.index({ institutionId: 1, userId: 1 });
export type QuotaDoc = InferSchemaType<typeof quotaSchema> & { _id: mongoose.Types.ObjectId };
export const CoachingQuota: Model<QuotaDoc> = (mongoose.models.CoachingQuota as Model<QuotaDoc>) || mongoose.model<QuotaDoc>("CoachingQuota", quotaSchema);

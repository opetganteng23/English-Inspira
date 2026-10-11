import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const auditSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    target: String,
    meta: Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

auditSchema.index({ at: -1 });
auditSchema.index({ actorId: 1, at: -1 });

export type AuditDoc = InferSchemaType<typeof auditSchema>;
export const AuditLog: Model<AuditDoc> =
  (mongoose.models.AuditLog as Model<AuditDoc>) || mongoose.model<AuditDoc>("AuditLog", auditSchema);

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const materialSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    summary: String,
    kind: { type: String, enum: ["rich", "html"], required: true },
    contentJson: Schema.Types.Mixed, // sumber TipTap
    contentHtml: String, // hasil render, sudah disanitasi
    htmlDoc: { html: String, css: String, js: String },
    assetIds: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
    tags: [String],
    access: { type: String, enum: ["free", "paid"], default: "paid" },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    version: { type: Number, default: 0 },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
  },
  { timestamps: true }
);

const versionSchema = new Schema(
  { materialId: { type: Schema.Types.ObjectId, ref: "Material", index: true }, version: Number, snapshot: Schema.Types.Mixed, authorId: Schema.Types.ObjectId },
  { timestamps: true }
);

const progressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    score: Number,
    answers: Schema.Types.Mixed,
    attempts: { type: Number, default: 0 },
    completedAt: Date,
  },
  { timestamps: true }
);
progressSchema.index({ userId: 1, materialId: 1 }, { unique: true });

const leadSchema = new Schema({ email: { type: String, required: true, unique: true, lowercase: true }, source: String }, { timestamps: true });

export type MaterialDoc = InferSchemaType<typeof materialSchema> & { _id: mongoose.Types.ObjectId };
export const Material: Model<MaterialDoc> = (mongoose.models.Material as Model<MaterialDoc>) || mongoose.model<MaterialDoc>("Material", materialSchema);
export const MaterialVersion = (mongoose.models.MaterialVersion as Model<InferSchemaType<typeof versionSchema>>) || mongoose.model("MaterialVersion", versionSchema);
export const MaterialProgress = (mongoose.models.MaterialProgress as Model<InferSchemaType<typeof progressSchema>>) || mongoose.model("MaterialProgress", progressSchema);
export const Lead = (mongoose.models.Lead as Model<InferSchemaType<typeof leadSchema>>) || mongoose.model("Lead", leadSchema);

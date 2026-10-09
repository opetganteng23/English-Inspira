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
    status: { type: String, enum: ["draft", "review", "published"], default: "draft", index: true }, // HTML wajib lewat review (MTS §10.3)
    version: { type: Number, default: 0 },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true }, // kosong = materi global (admin); terisi = hanya untuk institusi itu (materi coach/inst_admin)
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    editorId: { type: Schema.Types.ObjectId, ref: "User" }, // penyunting terakhir
    reviewerId: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewNote: String,
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

// Lampiran PDF materi (GridFS bucket `pdf`). Berkas ajar, bukan data pribadi.
const fileSchema = new Schema({ fileId: { type: Schema.Types.ObjectId, required: true }, filename: String, size: Number, uploaderId: { type: Schema.Types.ObjectId, ref: "User" } }, { timestamps: true });
export const MaterialFile = (mongoose.models.MaterialFile as Model<InferSchemaType<typeof fileSchema>>) || mongoose.model("MaterialFile", fileSchema);

const leadSchema = new Schema({ email: { type: String, required: true, unique: true, lowercase: true }, source: String }, { timestamps: true });

export type MaterialDoc = InferSchemaType<typeof materialSchema> & { _id: mongoose.Types.ObjectId };
export const Material: Model<MaterialDoc> = (mongoose.models.Material as Model<MaterialDoc>) || mongoose.model<MaterialDoc>("Material", materialSchema);
export const MaterialVersion = (mongoose.models.MaterialVersion as Model<InferSchemaType<typeof versionSchema>>) || mongoose.model("MaterialVersion", versionSchema);
export const MaterialProgress = (mongoose.models.MaterialProgress as Model<InferSchemaType<typeof progressSchema>>) || mongoose.model("MaterialProgress", progressSchema);
export const Lead = (mongoose.models.Lead as Model<InferSchemaType<typeof leadSchema>>) || mongoose.model("Lead", leadSchema);

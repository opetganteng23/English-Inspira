import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const schema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true },
    number: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    dueDate: Date,
    paidAt: Date,
  },
  { timestamps: true }
);
export type InstInvoiceDoc = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const InstInvoice: Model<InstInvoiceDoc> = (mongoose.models.InstInvoice as Model<InstInvoiceDoc>) || mongoose.model<InstInvoiceDoc>("InstInvoice", schema);

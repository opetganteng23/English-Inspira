import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// ---- Produk ----
export const PRODUCT_KINDS = ["single_sim", "itp_only", "journey", "bundle"] as const;
export const GRANT_TYPES = ["test", "counselor", "itp", "materials"] as const;
export type GrantType = (typeof GRANT_TYPES)[number];

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    kind: { type: String, enum: PRODUCT_KINDS, required: true },
    price: { type: Number, required: true, min: 0 },
    // test: ref=jenis tes, qty=jumlah attempt. counselor: qty=batas pesan/hari (0=tanpa batas).
    // itp: qty=jumlah pendaftaran. materials: akses semua materi berbayar.
    entitlements: [{ _id: false, kind: { type: String, enum: GRANT_TYPES, required: true }, ref: String, qty: { type: Number, default: 1 } }],
    validDays: { type: Number, default: 0 }, // 0 = tanpa kedaluwarsa
    highlight: Boolean,
    badge: String,
    sort: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: mongoose.Types.ObjectId };
export const Product = (mongoose.models.Product as Model<ProductDoc>) || mongoose.model<ProductDoc>("Product", productSchema);

// ---- Voucher ----
const voucherSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 1 },
    maxUse: { type: Number, default: 0 }, // 0 = tanpa batas
    used: { type: Number, default: 0 },
    validUntil: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type VoucherDoc = InferSchemaType<typeof voucherSchema> & { _id: mongoose.Types.ObjectId };
export const Voucher = (mongoose.models.Voucher as Model<VoucherDoc>) || mongoose.model<VoucherDoc>("Voucher", voucherSchema);

// ---- Order ----
export const ORDER_STATUS = ["pending", "paid", "failed", "refunded"] as const;
const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: [{ _id: false, productId: { type: Schema.Types.ObjectId, ref: "Product" }, name: String, price: Number }],
    subtotal: { type: Number, required: true },
    upgradeCredit: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    voucherCode: String,
    status: { type: String, enum: ORDER_STATUS, default: "pending", index: true },
    midtransOrderId: { type: String, required: true, unique: true },
    snapToken: String,
    mock: Boolean, // pembayaran simulasi (dev tanpa kunci Midtrans)
    paymentType: String,
    paidAt: Date,
    invoiceNo: { type: String, index: { unique: true, sparse: true } },
    buyer: { name: String, email: String, phone: String },
    history: [{ _id: false, status: String, at: Date, note: String }],
    lastNotification: Schema.Types.Mixed,
  },
  { timestamps: true }
);
export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: mongoose.Types.ObjectId };
export const Order = (mongoose.models.Order as Model<OrderDoc>) || mongoose.model<OrderDoc>("Order", orderSchema);

// ---- Entitlement: sumber kebenaran akses ----
const entitlementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    source: { type: String, enum: ["order", "institution", "manual"], required: true },
    // remaining = sisa jatah (test/itp); untuk counselor qty = batas pesan/hari.
    grants: [{ _id: false, kind: { type: String, enum: GRANT_TYPES, required: true }, ref: String, qty: Number, remaining: Number }],
    expiresAt: Date,
    note: String,
    revokedAt: Date,
  },
  { timestamps: true }
);
entitlementSchema.index({ userId: 1, expiresAt: 1 });
export type EntitlementDoc = InferSchemaType<typeof entitlementSchema> & { _id: mongoose.Types.ObjectId };
export const Entitlement = (mongoose.models.Entitlement as Model<EntitlementDoc>) || mongoose.model<EntitlementDoc>("Entitlement", entitlementSchema);

// ---- Counter atomik (nomor invoice/sertifikat) ----
const counterSchema = new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } });
export const Counter = (mongoose.models.Counter as Model<{ key: string; seq: number }>) || mongoose.model<{ key: string; seq: number }>("Counter", counterSchema);
export async function nextSeq(key: string) {
  const c = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return c.seq;
}

// ---- Pengaturan (key-value) ----
const settingSchema = new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed }, { timestamps: true });
export const Setting = (mongoose.models.Setting as Model<{ key: string; value: unknown }>) || mongoose.model<{ key: string; value: unknown }>("Setting", settingSchema);
export async function getSetting<T extends object>(key: string, fallback: T): Promise<T> {
  const s = await Setting.findOne({ key }).lean();
  return s ? ({ ...fallback, ...(s.value as object) } as T) : fallback;
}

import type { Types } from "mongoose";
import { Product, Voucher, Order, type ProductDoc, type VoucherDoc } from "@/models/Commerce";
import { HttpError } from "./rbac";

/** Hitung diskon voucher dari jumlah dasar. Murni (mudah diuji). */
export function voucherDiscount(v: Pick<VoucherDoc, "type" | "value">, base: number) {
  const d = v.type === "percent" ? Math.floor((base * Math.min(v.value, 100)) / 100) : v.value;
  return Math.max(0, Math.min(d, base));
}

export function voucherProblem(v: Pick<VoucherDoc, "active" | "validUntil" | "maxUse" | "used"> | null) {
  if (!v || !v.active) return "Kode voucher tidak ditemukan";
  if (v.validUntil && v.validUntil.getTime() < Date.now()) return "Voucher sudah kedaluwarsa";
  if (v.maxUse > 0 && v.used >= v.maxUse) return "Kuota voucher habis";
  return null;
}

/** Potongan upgrade ke Journey = total pembelian satuan yang sudah dibayar dan belum pernah dikreditkan. */
export async function upgradeCredit(userId: Types.ObjectId | string, journeyPrice: number) {
  const paid = await Order.find({ userId, status: "paid" }).select("items upgradeCredit").lean();
  const ids = Array.from(new Set(paid.flatMap((o) => o.items.map((i) => String(i.productId)))));
  const singles = new Set((await Product.find({ _id: { $in: ids }, kind: { $in: ["single_sim", "itp_only", "bundle"] } }).select("_id").lean()).map((p) => String(p._id)));
  const spent = paid.reduce((n, o) => n + o.items.filter((i) => singles.has(String(i.productId))).reduce((a, i) => a + (i.price ?? 0), 0), 0);
  const credited = paid.reduce((n, o) => n + (o.upgradeCredit ?? 0), 0);
  return Math.max(0, Math.min(journeyPrice, spent - credited));
}

export type PricedCart = Awaited<ReturnType<typeof priceCart>>;

export async function priceCart(userId: Types.ObjectId | string, productIds: string[], voucherCode?: string | null) {
  const unique = Array.from(new Set(productIds));
  if (!unique.length) throw new HttpError(400, "Keranjang kosong");
  const products = await Product.find({ _id: { $in: unique }, active: true }).lean();
  if (products.length !== unique.length) throw new HttpError(400, "Ada produk yang tidak tersedia");
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = unique.map((id) => byId.get(id)!);

  const subtotal = items.reduce((n, p) => n + p.price, 0);
  const journey = items.find((p) => p.kind === "journey");
  const credit = journey ? await upgradeCredit(userId, journey.price) : 0;

  let voucher: { code: string; discount: number } | null = null;
  let voucherError: string | null = null;
  if (voucherCode?.trim()) {
    const v = await Voucher.findOne({ code: voucherCode.trim().toUpperCase() }).lean();
    voucherError = voucherProblem(v);
    if (!voucherError && v) voucher = { code: v.code, discount: voucherDiscount(v, subtotal - credit) };
  }
  const total = Math.max(0, subtotal - credit - (voucher?.discount ?? 0));

  // Saran hemat: ITP saja -> bundle ITP + Tes Simulasi
  let suggestion: { fromId: string; toId: string; toName: string; toPrice: number } | null = null;
  const itpOnly = items.find((p) => p.slug === "itp-only");
  if (itpOnly && !items.some((p) => p.slug === "itp-sim-bundle")) {
    const b = await Product.findOne({ slug: "itp-sim-bundle", active: true }).lean();
    if (b) suggestion = { fromId: String(itpOnly._id), toId: String(b._id), toName: b.name, toPrice: b.price };
  }
  return {
    items: items.map((p: ProductDoc & { _id: Types.ObjectId }) => ({ id: String(p._id), slug: p.slug, name: p.name, kind: p.kind, price: p.price, description: p.description })),
    subtotal, upgradeCredit: credit, voucher, voucherError, total, suggestion,
  };
}

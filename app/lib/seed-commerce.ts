import { connectDB } from "./db";
import { Product, Voucher } from "@/models/Commerce";

// HARGA & MASA BERLAKU = PLACEHOLDER (bagian 17 spec: harga final belum diputuskan bisnis).
const PRODUCTS = [
  {
    slug: "sim-1", name: "Tes Simulasi ITP", kind: "single_sim", price: 149000, sort: 1, validDays: 30,
    description: "140 soal format penuh, laporan lengkap, Konselor AI 30 hari.",
    entitlements: [{ kind: "test", ref: "sim", qty: 1 }, { kind: "counselor", qty: 20 }],
  },
  {
    slug: "itp-only", name: "Pendaftaran TOEFL ITP Resmi", kind: "itp_only", price: 650000, sort: 2, validDays: 365,
    description: "1× tes resmi. Pilih jadwal setelah pembayaran.",
    entitlements: [{ kind: "itp", qty: 1 }],
  },
  {
    slug: "itp-sim-bundle", name: "ITP Resmi + Tes Simulasi", kind: "bundle", price: 850000, sort: 3, validDays: 120,
    description: "2× Tes Simulasi lalu 1× tes TOEFL ITP resmi, Konselor AI selama masa paket.",
    entitlements: [{ kind: "test", ref: "sim", qty: 2 }, { kind: "itp", qty: 1 }, { kind: "counselor", qty: 20 }],
  },
  {
    slug: "journey-6m", name: "Paket Journey 6 Bulan", kind: "journey", price: 1490000, sort: 4, validDays: 180, highlight: true, badge: "DISARANKAN",
    description: "4× Diagnostic, 2× Prediction, 1× ITP resmi, Materi lengkap, Konselor AI tanpa batas 6 bulan.",
    entitlements: [{ kind: "test", ref: "diagnostic", qty: 4 }, { kind: "test", ref: "prediction", qty: 2 }, { kind: "itp", qty: 1 }, { kind: "counselor", qty: 0 }, { kind: "materials", qty: 1 }],
  },
];

export async function seedCommerce() {
  await connectDB();
  for (const p of PRODUCTS) await Product.updateOne({ slug: p.slug }, { $setOnInsert: p }, { upsert: true });
  await Voucher.updateOne({ code: "INSPIRA10" }, { $setOnInsert: { code: "INSPIRA10", type: "percent", value: 10, maxUse: 0, active: true } }, { upsert: true });
  return { products: await Product.countDocuments(), vouchers: await Voucher.countDocuments() };
}

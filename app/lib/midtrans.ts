import { createHash, timingSafeEqual } from "node:crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require("midtrans-client");

export const midtransEnabled = () => !!process.env.MIDTRANS_SERVER_KEY;
export const midtransIsProduction = () => process.env.MIDTRANS_IS_PRODUCTION === "true";

export async function createSnapToken(p: {
  orderId: string; amount: number; buyer: { name?: string | null; email: string; phone?: string | null };
  items: { id: string; name: string; price: number }[];
}) {
  const snap = new midtransClient.Snap({
    isProduction: midtransIsProduction(),
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });
  // Midtrans mewajibkan jumlah item = gross_amount; diskon/kredit upgrade dikirim sebagai item negatif.
  const itemsSum = p.items.reduce((n, i) => n + i.price, 0);
  const lines = p.items.map((i) => ({ id: i.id, price: i.price, quantity: 1, name: i.name.slice(0, 50) }));
  if (itemsSum !== p.amount) lines.push({ id: "ADJUST", price: p.amount - itemsSum, quantity: 1, name: "Diskon / potongan" });
  const res = await snap.createTransaction({
    transaction_details: { order_id: p.orderId, gross_amount: p.amount },
    customer_details: { first_name: p.buyer.name ?? p.buyer.email, email: p.buyer.email, phone: p.buyer.phone ?? undefined },
    item_details: lines,
    expiry: { unit: "hours", duration: 24 },
  });
  return res.token as string;
}

/** SHA512(order_id + status_code + gross_amount + ServerKey), dibandingkan constant-time. */
export function verifySignature(n: { order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string }, serverKey = process.env.MIDTRANS_SERVER_KEY ?? "") {
  if (!n.order_id || !n.status_code || !n.gross_amount || !n.signature_key || !serverKey) return false;
  const expected = createHash("sha512").update(n.order_id + n.status_code + n.gross_amount + serverKey).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(n.signature_key));
  return a.length === b.length && timingSafeEqual(a, b);
}

export type OrderStatus = "pending" | "paid" | "failed" | "refunded";
export function mapStatus(n: { transaction_status?: string; fraud_status?: string }): OrderStatus {
  const s = n.transaction_status;
  if (s === "settlement") return "paid";
  if (s === "capture") return n.fraud_status === "challenge" ? "pending" : "paid";
  if (s === "refund" || s === "partial_refund" || s === "chargeback") return "refunded";
  if (s === "deny" || s === "cancel" || s === "expire" || s === "failure") return "failed";
  return "pending";
}

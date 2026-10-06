import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Commerce";
import { mapStatus, verifySignature } from "@/lib/midtrans";
import { applyOrderStatus } from "@/lib/orders";

/** Webhook Midtrans. Tidak pernah mempercayai status dari klien; wajib signature_key valid dan nominal cocok. */
export async function POST(req: Request) {
  const n = await req.json().catch(() => null);
  if (!n || !verifySignature(n)) return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  await connectDB();
  const order = await Order.findOne({ midtransOrderId: n.order_id });
  if (!order) return NextResponse.json({ ok: true }); // order tak dikenal: jangan memicu retry tanpa henti
  if (Math.round(parseFloat(n.gross_amount)) !== order.total) return NextResponse.json({ error: "Nominal tidak cocok" }, { status: 400 });
  await applyOrderStatus(order._id, mapStatus(n), { paymentType: n.payment_type, notification: n });
  return NextResponse.json({ ok: true });
}

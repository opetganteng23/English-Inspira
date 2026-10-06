import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Order } from "@/models/Commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const orders = await Order.find({ userId: user._id }).select("-snapToken -lastNotification").sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({
      orders: orders.map((o) => ({
        id: String(o._id), invoiceNo: o.invoiceNo ?? null, midtransOrderId: o.midtransOrderId, status: o.status, total: o.total, subtotal: o.subtotal,
        discount: o.discount, upgradeCredit: o.upgradeCredit, voucherCode: o.voucherCode ?? null, paymentType: o.paymentType ?? null,
        items: o.items.map((i) => ({ name: i.name, price: i.price })), createdAt: o.createdAt, paidAt: o.paidAt ?? null, history: o.history,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

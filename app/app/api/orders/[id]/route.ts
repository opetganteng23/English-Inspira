import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Order } from "@/models/Commerce";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Order tidak ditemukan");
    await connectDB();
    const o = await Order.findById(params.id).lean();
    if (!o || (String(o.userId) !== String(user._id) && user.role !== "admin")) throw new HttpError(404, "Order tidak ditemukan");
    return NextResponse.json({
      id: String(o._id), invoiceNo: o.invoiceNo ?? null, midtransOrderId: o.midtransOrderId, status: o.status, total: o.total, subtotal: o.subtotal,
      discount: o.discount, upgradeCredit: o.upgradeCredit, voucherCode: o.voucherCode ?? null, paymentType: o.paymentType ?? null,
      mock: !!o.mock && process.env.NODE_ENV !== "production", snapToken: o.status === "pending" ? o.snapToken ?? null : null,
      clientKey: process.env.MIDTRANS_CLIENT_KEY ?? null, production: process.env.MIDTRANS_IS_PRODUCTION === "true",
      items: o.items.map((i) => ({ productId: String(i.productId), name: i.name, price: i.price })),
      createdAt: o.createdAt, paidAt: o.paidAt ?? null, expiresAt: new Date(+new Date(o.createdAt) + 24 * 3600_000), history: o.history,
    });
  } catch (e) {
    return handleError(e);
  }
}

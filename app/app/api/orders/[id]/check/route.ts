import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Order } from "@/models/Commerce";
import { mapStatus, midtransEnabled, midtransIsProduction } from "@/lib/midtrans";
import { applyOrderStatus } from "@/lib/orders";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require("midtrans-client");

/** Tombol "Cek status pembayaran": tanya Midtrans langsung (server-ke-server), lalu terapkan secara idempoten. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Order tidak ditemukan");
    await connectDB();
    const o = await Order.findById(params.id);
    if (!o || (String(o.userId) !== String(user._id) && user.role !== "admin")) throw new HttpError(404, "Order tidak ditemukan");
    if (o.status === "pending" && midtransEnabled() && !o.mock) {
      const core = new midtransClient.CoreApi({ isProduction: midtransIsProduction(), serverKey: process.env.MIDTRANS_SERVER_KEY, clientKey: process.env.MIDTRANS_CLIENT_KEY });
      try {
        const s = await core.transaction.status(o.midtransOrderId);
        await applyOrderStatus(o._id, mapStatus(s), { paymentType: s.payment_type, notification: s });
      } catch { /* transaksi belum dibuat di Midtrans: tetap pending */ }
    }
    const fresh = await Order.findById(o._id).select("status").lean();
    return NextResponse.json({ status: fresh?.status });
  } catch (e) {
    return handleError(e);
  }
}

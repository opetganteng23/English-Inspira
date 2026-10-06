import { Order, Product, Voucher, Entitlement, nextSeq } from "@/models/Commerce";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { grantProduct } from "./entitlements";
import { sendMail, orderPaidEmail } from "./mailer";
import type { OrderStatus } from "./midtrans";
import type { Types } from "mongoose";

/**
 * Terapkan status dari gateway ke order. Idempoten: transisi pending -> paid hanya terjadi sekali,
 * jadi webhook ganda tidak membuat entitlement ganda.
 */
export async function applyOrderStatus(orderId: Types.ObjectId | string, status: OrderStatus, meta: { paymentType?: string; notification?: unknown; note?: string } = {}) {
  if (status === "paid") {
    const year = new Date().getFullYear();
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: "pending" },
      { status: "paid", paidAt: new Date(), paymentType: meta.paymentType, lastNotification: meta.notification, $push: { history: { status: "paid", at: new Date(), note: meta.note } } },
      { new: true }
    );
    if (!order) return { changed: false };
    order.invoiceNo = `INV-${year}-${String(await nextSeq(`invoice-${year}`)).padStart(4, "0")}`;
    await order.save();

    const products = await Product.find({ _id: { $in: order.items.map((i) => i.productId).filter((x): x is NonNullable<typeof x> => !!x) } }).lean();
    for (const p of products) await grantProduct(order.userId, p, { source: "order", orderId: order._id });
    if (order.voucherCode) await Voucher.updateOne({ code: order.voucherCode }, { $inc: { used: 1 } });

    const user = await User.findById(order.userId).select("email name").lean();
    if (user) void sendMail(order.buyer?.email || user.email, `Pembayaran berhasil ${order.invoiceNo}`, orderPaidEmail(order.invoiceNo!, order.total, order.items.map((i) => i.name ?? ""))).catch(() => {});
    return { changed: true, order };
  }

  if (status === "failed") {
    const o = await Order.findOneAndUpdate({ _id: orderId, status: "pending" }, { status: "failed", lastNotification: meta.notification, $push: { history: { status: "failed", at: new Date(), note: meta.note } } }, { new: true });
    return { changed: !!o, order: o };
  }

  if (status === "refunded") {
    const o = await Order.findOneAndUpdate({ _id: orderId, status: "paid" }, { status: "refunded", lastNotification: meta.notification, $push: { history: { status: "refunded", at: new Date(), note: meta.note } } }, { new: true });
    if (o) await Entitlement.updateMany({ orderId: o._id }, { revokedAt: new Date() }); // cabut akses dari order ini
    return { changed: !!o, order: o };
  }
  return { changed: false };
}

export async function audit(actorId: Types.ObjectId | string | undefined, action: string, target?: string, meta?: unknown) {
  await AuditLog.create({ actorId, action, target, meta });
}

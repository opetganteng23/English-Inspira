import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Order } from "@/models/Commerce";
import { invoicePdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Order tidak ditemukan");
    await connectDB();
    const o = await Order.findById(params.id).lean();
    if (!o || (String(o.userId) !== String(user._id) && user.role !== "admin")) throw new HttpError(404, "Order tidak ditemukan");
    if (o.status !== "paid" && o.status !== "refunded") throw new HttpError(409, "Invoice tersedia setelah pembayaran lunas");
    const pdf = await invoicePdf({
      invoiceNo: o.invoiceNo ?? o.midtransOrderId, status: o.status, paidAt: o.paidAt, createdAt: o.createdAt, buyer: { name: o.buyer?.name, email: o.buyer?.email },
      items: o.items.map((i) => ({ name: i.name ?? "", price: i.price ?? 0 })), subtotal: o.subtotal, upgradeCredit: o.upgradeCredit ?? 0,
      discount: o.discount ?? 0, voucherCode: o.voucherCode, total: o.total, paymentType: o.paymentType,
    });
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${o.invoiceNo ?? "invoice"}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

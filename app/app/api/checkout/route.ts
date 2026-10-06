import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { priceCart } from "@/lib/pricing";
import { Order } from "@/models/Commerce";
import { createSnapToken, midtransEnabled } from "@/lib/midtrans";
import { applyOrderStatus } from "@/lib/orders";

const schema = z.object({
  productIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).min(1).max(10),
  voucherCode: z.string().max(40).optional(),
  buyer: z.object({ name: z.string().trim().min(1).max(100), email: z.email(), phone: z.string().trim().max(20).optional() }),
  agree: z.literal(true, { message: "Setujui Syarat & Ketentuan dan Kebijakan Refund" }),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const b = schema.parse(await req.json());
    await connectDB();

    const cart = await priceCart(user._id, b.productIds, b.voucherCode);
    if (b.voucherCode?.trim() && cart.voucherError) throw new HttpError(400, cart.voucherError);

    const midtransOrderId = `EPTA-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const order = await Order.create({
      userId: user._id,
      items: cart.items.map((i) => ({ productId: i.id, name: i.name, price: i.price })),
      subtotal: cart.subtotal, upgradeCredit: cart.upgradeCredit, discount: cart.voucher?.discount ?? 0, total: cart.total,
      voucherCode: cart.voucher?.code, midtransOrderId, buyer: b.buyer,
      history: [{ status: "pending", at: new Date() }],
    });

    // Gratis (voucher 100% / kredit upgrade menutup semua): langsung lunas, tanpa gateway.
    if (cart.total === 0) {
      await applyOrderStatus(order._id, "paid", { paymentType: "free", note: "Total Rp0" });
      return NextResponse.json({ orderId: String(order._id), paid: true });
    }

    if (midtransEnabled()) {
      const snapToken = await createSnapToken({
        orderId: midtransOrderId, amount: cart.total, buyer: b.buyer,
        items: cart.items.map((i) => ({ id: i.id, name: i.name, price: i.price })),
      });
      order.snapToken = snapToken;
      await order.save();
      return NextResponse.json({ orderId: String(order._id), snapToken, clientKey: process.env.MIDTRANS_CLIENT_KEY, production: process.env.MIDTRANS_IS_PRODUCTION === "true" });
    }

    if (process.env.NODE_ENV === "production") throw new HttpError(503, "Pembayaran belum dikonfigurasi");
    order.mock = true; // dev: simulasi di halaman pembayaran
    await order.save();
    return NextResponse.json({ orderId: String(order._id), mock: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

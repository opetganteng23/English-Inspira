import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Order } from "@/models/Commerce";
import { applyOrderStatus } from "@/lib/orders";

/** Simulasi pembayaran untuk dev tanpa kunci Midtrans. Mati di production dan hanya untuk order bertanda mock. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Order tidak ditemukan");
    await connectDB();
    const o = await Order.findById(params.id);
    if (!o || !o.mock || String(o.userId) !== String(user._id)) throw new HttpError(404, "Order tidak ditemukan");
    const { result } = await req.json().catch(() => ({ result: "paid" }));
    await applyOrderStatus(o._id, result === "failed" ? "failed" : "paid", { paymentType: "mock_va", note: "Simulasi dev" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { applyOrderStatus, audit } from "@/lib/orders";
import { Order } from "@/models/Commerce";

/**
 * Tandai order direfund dan cabut akses dari order itu. Pengembalian dana ke pembeli dilakukan di dashboard Midtrans;
 * di sini hanya pencatatan status + pencabutan akses, dan alasan wajib diisi (masuk audit log).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Order tidak ditemukan");
    const { reason } = z.object({ reason: z.string().trim().min(3, "Isi alasan refund").max(300) }).parse(await req.json());
    await connectDB();
    const o = await Order.findById(params.id).select("status").lean();
    if (!o) throw new HttpError(404, "Order tidak ditemukan");
    if (o.status !== "paid") throw new HttpError(409, "Hanya order lunas yang bisa direfund");
    await applyOrderStatus(params.id, "refunded", { note: `Admin: ${reason}` });
    await audit(admin._id, "order.refund", params.id, { reason });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

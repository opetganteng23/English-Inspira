import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Order } from "@/models/Commerce";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    if (sp.get("status")) filter.status = sp.get("status");
    const q = sp.get("q")?.trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const us = await User.find({ $or: [{ email: rx }, { name: rx }] }).select("_id").limit(200).lean();
      filter.$or = [{ invoiceNo: rx }, { midtransOrderId: rx }, { userId: { $in: us.map((u) => u._id) } }];
    }
    const page = Math.max(1, Number(sp.get("page")) || 1), size = 25;
    const [orders, total] = await Promise.all([Order.find(filter).select("-snapToken -lastNotification").sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(), Order.countDocuments(filter)]);
    const users = new Map((await User.find({ _id: { $in: orders.map((o) => o.userId) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    return NextResponse.json({
      total, page, pages: Math.ceil(total / size),
      orders: orders.map((o) => ({
        id: String(o._id), invoiceNo: o.invoiceNo ?? null, midtransOrderId: o.midtransOrderId, status: o.status, total: o.total, voucherCode: o.voucherCode ?? null, paymentType: o.paymentType ?? null,
        user: users.get(String(o.userId))?.name ?? users.get(String(o.userId))?.email ?? "-", email: users.get(String(o.userId))?.email,
        items: o.items.map((i) => i.name), createdAt: o.createdAt, paidAt: o.paidAt ?? null, mock: !!o.mock,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

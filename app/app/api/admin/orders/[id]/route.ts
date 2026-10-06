import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Order, Entitlement } from "@/models/Commerce";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Order tidak ditemukan");
    await connectDB();
    const o = await Order.findById(params.id).select("-snapToken").lean();
    if (!o) throw new HttpError(404, "Order tidak ditemukan");
    const [u, ents] = await Promise.all([User.findById(o.userId).select("name email phone").lean(), Entitlement.find({ orderId: o._id }).lean()]);
    return NextResponse.json({
      ...o, id: String(o._id), _id: undefined, user: u ? { id: String(u._id), name: u.name, email: u.email, phone: u.phone } : null,
      entitlements: ents.map((e) => ({ id: String(e._id), grants: e.grants, expiresAt: e.expiresAt ?? null, revoked: !!e.revokedAt })),
    });
  } catch (e) {
    return handleError(e);
  }
}

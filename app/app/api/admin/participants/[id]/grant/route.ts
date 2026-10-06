import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { grantProduct } from "@/lib/entitlements";
import { User } from "@/models/User";
import { Product, Entitlement } from "@/models/Commerce";

/** Buka akses manual (productId + alasan) atau perpanjang entitlement (extendId + days). Keduanya masuk audit log. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Peserta tidak ditemukan");
    const b = z.union([
      z.object({ productId: z.string().regex(/^[0-9a-f]{24}$/), reason: z.string().trim().min(3, "Isi alasan").max(300) }),
      z.object({ extendId: z.string().regex(/^[0-9a-f]{24}$/), days: z.number().int().min(1).max(365), reason: z.string().trim().min(3, "Isi alasan").max(300) }),
    ]).parse(await req.json());
    await connectDB();
    if (!(await User.exists({ _id: params.id }))) throw new HttpError(404, "Peserta tidak ditemukan");

    if ("productId" in b) {
      const p = await Product.findById(b.productId).lean();
      if (!p) throw new HttpError(404, "Paket tidak ditemukan");
      await grantProduct(params.id, p, { source: "manual", note: `Manual: ${b.reason}` });
      await audit(admin._id, "access.grant", params.id, { product: p.slug, reason: b.reason });
    } else {
      const e = await Entitlement.findOne({ _id: b.extendId, userId: params.id });
      if (!e) throw new HttpError(404, "Akses tidak ditemukan");
      const base = e.expiresAt && e.expiresAt > new Date() ? e.expiresAt : new Date();
      e.expiresAt = new Date(+base + b.days * 86_400_000);
      e.revokedAt = undefined;
      await e.save();
      await audit(admin._id, "access.extend", params.id, { entitlementId: b.extendId, days: b.days, reason: b.reason });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Product } from "@/models/Commerce";
import { activeEntitlements } from "@/lib/entitlements";
import { handleError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Katalog publik. Bila sudah masuk, tiap produk diberi penanda sudah dimiliki. */
export async function GET() {
  try {
    await connectDB();
    const products = await Product.find({ active: true }).sort({ sort: 1, price: 1 }).lean();
    const user = await getCurrentUser();
    const owned = new Set<string>();
    if (user) for (const e of await activeEntitlements(user._id)) if (e.productId) owned.add(String(e.productId));
    return NextResponse.json({
      products: products.map((p) => ({
        id: String(p._id), slug: p.slug, name: p.name, description: p.description, kind: p.kind, price: p.price,
        entitlements: p.entitlements, validDays: p.validDays, highlight: !!p.highlight, badge: p.badge ?? null, owned: owned.has(String(p._id)),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

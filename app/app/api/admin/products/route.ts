import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { productInput } from "@/lib/admin-schemas";
import { Product, Order } from "@/models/Commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [products, sales] = await Promise.all([
      Product.find().sort({ sort: 1, price: 1 }).lean(),
      Order.aggregate([{ $match: { status: "paid" } }, { $unwind: "$items" }, { $group: { _id: "$items.productId", n: { $sum: 1 } } }]),
    ]);
    const n = new Map(sales.map((s) => [String(s._id), s.n]));
    return NextResponse.json({ products: products.map((p) => ({ ...p, id: String(p._id), _id: undefined, sold: n.get(String(p._id)) ?? 0 })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = productInput.parse(await req.json());
    await connectDB();
    if (await Product.exists({ slug: b.slug })) throw new HttpError(409, "Slug sudah dipakai");
    const p = await Product.create(b);
    await audit(admin._id, "product.create", String(p._id));
    return NextResponse.json({ id: String(p._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

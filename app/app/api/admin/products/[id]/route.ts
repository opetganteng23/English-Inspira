import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { productInput } from "@/lib/admin-schemas";
import { Product, Order } from "@/models/Commerce";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Paket tidak ditemukan");
  await connectDB();
  const p = await Product.findById(id);
  if (!p) throw new HttpError(404, "Paket tidak ditemukan");
  return p;
}

/** Perubahan harga tidak memengaruhi order yang sudah dibuat (order menyimpan harga saat dibeli). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const p = await find(params.id);
    const b = productInput.parse(await req.json());
    if (b.slug !== p.slug && (await Product.exists({ slug: b.slug }))) throw new HttpError(409, "Slug sudah dipakai");
    p.set(b);
    await p.save();
    await audit(admin._id, "product.update", params.id, { price: b.price });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const p = await find(params.id);
    if (await Order.exists({ "items.productId": p._id })) throw new HttpError(409, "Paket sudah pernah dibeli. Nonaktifkan saja, jangan dihapus.");
    await p.deleteOne();
    await audit(admin._id, "product.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

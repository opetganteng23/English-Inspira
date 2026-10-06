import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { institutionInput } from "@/lib/admin-schemas";
import { Institution } from "@/models/Institution";
import { Product } from "@/models/Commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [list, prods] = await Promise.all([Institution.find().sort({ createdAt: -1 }).lean(), Product.find().select("name").lean()]);
    const pn = new Map(prods.map((p) => [String(p._id), p.name]));
    return NextResponse.json({
      institutions: list.map((i) => ({ id: String(i._id), name: i.name, code: i.code, seats: i.seats, seatsUsed: i.seatsUsed, contactEmail: i.contactEmail ?? "", batch: i.batch ?? "", productId: i.productId ? String(i.productId) : null, product: i.productId ? pn.get(String(i.productId)) ?? null : null, validUntil: i.validUntil ?? null, active: i.active })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = institutionInput.parse(await req.json());
    await connectDB();
    if (await Institution.exists({ code: b.code })) throw new HttpError(409, "Kode institusi sudah dipakai");
    const i = await Institution.create({ ...b, productId: b.productId ?? undefined, validUntil: b.validUntil ?? undefined, contactEmail: b.contactEmail || undefined });
    await audit(admin._id, "institution.create", String(i._id));
    return NextResponse.json({ id: String(i._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

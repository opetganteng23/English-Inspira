import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { priceCart } from "@/lib/pricing";

const schema = z.object({ productIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(10), voucherCode: z.string().max(40).optional() });

export async function POST(req: Request) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const b = schema.parse(await req.json());
    await connectDB();
    return NextResponse.json(await priceCart(user._id, b.productIds, b.voucherCode));
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

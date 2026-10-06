import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { priceCart } from "@/lib/pricing";

const schema = z.object({ code: z.string().trim().min(1).max(40), productIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).min(1).max(10) });

/** Cek voucher terhadap isi keranjang. Voucher baru dihitung terpakai saat order lunas. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const b = schema.parse(await req.json());
    await connectDB();
    const cart = await priceCart(user._id, b.productIds, b.code);
    if (cart.voucherError) return NextResponse.json({ error: cart.voucherError }, { status: 400 });
    return NextResponse.json({ voucher: cart.voucher, total: cart.total });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { voucherInput } from "@/lib/admin-schemas";
import { Voucher } from "@/models/Commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const v = await Voucher.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ vouchers: v.map((x) => ({ id: String(x._id), code: x.code, type: x.type, value: x.value, maxUse: x.maxUse, used: x.used, validUntil: x.validUntil ?? null, active: x.active })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = voucherInput.parse(await req.json());
    await connectDB();
    if (await Voucher.exists({ code: b.code })) throw new HttpError(409, "Kode voucher sudah ada");
    const v = await Voucher.create({ ...b, validUntil: b.validUntil ?? undefined });
    await audit(admin._id, "voucher.create", String(v._id));
    return NextResponse.json({ id: String(v._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

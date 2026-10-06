import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { InstInvoice } from "@/models/InstInvoice";
import { nextSeq } from "@/models/Commerce";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institusi tidak ditemukan");
    await connectDB();
    const list = await InstInvoice.find({ institutionId: params.id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ invoices: list.map((i) => ({ id: String(i._id), number: i.number, description: i.description, amount: i.amount, status: i.status, dueDate: i.dueDate ?? null, paidAt: i.paidAt ?? null })) });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({ description: z.string().trim().min(1).max(200), amount: z.number().int().min(0), dueDate: z.coerce.date().optional() });
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institusi tidak ditemukan");
    const b = schema.parse(await req.json());
    await connectDB();
    const y = new Date().getFullYear();
    const inv = await InstInvoice.create({ ...b, institutionId: params.id, number: `INST-${y}-${String(await nextSeq(`instinv-${y}`)).padStart(4, "0")}` });
    await audit(admin._id, "inst_invoice.create", String(inv._id));
    return NextResponse.json({ id: String(inv._id), number: inv.number }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

/** Tandai lunas/belum: PATCH {invoiceId, status}. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const b = z.object({ invoiceId: z.string().regex(/^[0-9a-f]{24}$/), status: z.enum(["unpaid", "paid"]) }).parse(await req.json());
    await connectDB();
    const r = await InstInvoice.updateOne({ _id: b.invoiceId, institutionId: params.id }, { status: b.status, paidAt: b.status === "paid" ? new Date() : undefined });
    if (!r.matchedCount) throw new HttpError(404, "Tagihan tidak ditemukan");
    await audit(admin._id, "inst_invoice.status", b.invoiceId, { status: b.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

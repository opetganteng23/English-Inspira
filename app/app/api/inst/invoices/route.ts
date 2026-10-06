import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { InstInvoice } from "@/models/InstInvoice";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { inst } = await instContext(req);
    const list = await InstInvoice.find({ institutionId: inst._id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ invoices: list.map((i) => ({ id: String(i._id), number: i.number, description: i.description, amount: i.amount, status: i.status, dueDate: i.dueDate ?? null, paidAt: i.paidAt ?? null })) });
  } catch (e) {
    return handleError(e);
  }
}

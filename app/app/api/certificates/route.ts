import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Certificate } from "@/models/Itp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const list = await Certificate.find({ userId: user._id }).sort({ issuedAt: -1 }).lean();
    return NextResponse.json({
      certificates: list.map((c) => ({ id: String(c._id), type: c.type, number: c.number, issuedAt: c.issuedAt, data: c.data, verifyUrl: `/verify/${c.number}` })),
    });
  } catch (e) {
    return handleError(e);
  }
}

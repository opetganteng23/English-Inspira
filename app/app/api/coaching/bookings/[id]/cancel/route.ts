import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { cancelBooking } from "@/lib/coaching";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    await cancelBooking(me, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

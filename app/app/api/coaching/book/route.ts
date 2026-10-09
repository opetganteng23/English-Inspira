import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError } from "@/lib/rbac";
import { bookSlot } from "@/lib/coaching";

export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    const { slotId } = z.object({ slotId: z.string().regex(/^[0-9a-f]{24}$/) }).parse(await req.json());
    const b = await bookSlot(me, slotId);
    return NextResponse.json({ id: String(b._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Slot tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

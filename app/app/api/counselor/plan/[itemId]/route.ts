import { NextResponse } from "next/server";
import { z } from "zod";
import { Types, isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { CounselorThread } from "@/models/Counselor";

/** Centang / batalkan centang butir rencana aksi milik sendiri. */
export async function PATCH(req: Request, { params }: { params: { itemId: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.itemId)) throw new HttpError(404, "Item not found");
    const { done } = z.object({ done: z.boolean() }).parse(await req.json());
    await connectDB();
    const r = await CounselorThread.updateOne(
      { userId: user._id, "actionPlan._id": new Types.ObjectId(params.itemId) },
      { $set: { "actionPlan.$.done": done } }
    );
    if (!r.matchedCount) throw new HttpError(404, "Item not found");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

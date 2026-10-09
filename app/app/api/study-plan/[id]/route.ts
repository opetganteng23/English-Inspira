import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { PlanItem } from "@/models/Learning";

/** Centang/batalkan item rencana milik sendiri. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    const { done } = z.object({ done: z.boolean() }).parse(await req.json());
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Item tidak ditemukan");
    await connectDB();
    const it = await PlanItem.findOne({ _id: params.id, userId: me._id });
    if (!it) throw new HttpError(404, "Item tidak ditemukan");
    if (it.status === "resolved" || it.status === "expired") throw new HttpError(409, "Item ini sudah tidak aktif");
    it.status = done ? "done" : "active"; it.doneAt = done ? new Date() : undefined;
    await it.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { RemedialMap } from "@/models/Course";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Mapping not found");
    await connectDB();
    const r = await RemedialMap.deleteOne({ _id: params.id });
    if (!r.deletedCount) throw new HttpError(404, "Mapping not found");
    await audit(admin._id, "remedial.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { connectDB } from "@/lib/db";
import { handleInvites } from "@/lib/member-routes";

/** Undang peserta lewat daftar email (juga untuk input manual satu per satu). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institution not found");
    await connectDB();
    return await handleInvites(req, params.id, admin._id);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

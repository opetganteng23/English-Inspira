import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { connectDB } from "@/lib/db";
import { inviteInput, sendInvites } from "@/lib/invites";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institusi tidak ditemukan");
    const b = inviteInput.parse(await req.json());
    await connectDB();
    return NextResponse.json({ results: await sendInvites(params.id, b.emails, admin._id) });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Email tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

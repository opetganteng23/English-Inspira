import { z } from "zod";
import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { handleInvites } from "@/lib/member-routes";

export async function POST(req: Request) {
  try {
    const { user, inst } = await instContext(req);
    return await handleInvites(req, inst._id, user._id);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { inviteInput, sendInvites } from "@/lib/invites";

export async function POST(req: Request) {
  try {
    const { user, inst } = await instContext(req);
    const b = inviteInput.parse(await req.json());
    return NextResponse.json({ results: await sendInvites(inst._id, b.emails, user._id) });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Email tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

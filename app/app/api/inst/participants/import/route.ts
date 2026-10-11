import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";
import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { handleImport } from "@/lib/member-routes";

/** inst_admin selalu mengimpor ke institusinya sendiri (parameter query diabaikan oleh instContext). */
export async function POST(req: Request) {
  try {
    const { user, inst } = await instContext(req);
    return await handleImport(req, inst._id, user._id);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

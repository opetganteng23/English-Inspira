import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError } from "@/lib/rbac";
import { Notification } from "@/models/Access";

/** Tandai dibaca: daftar id tertentu, atau semua bila `all`. Hanya milik sendiri. */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const b = z.object({ all: z.boolean().optional(), ids: z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(100).optional() }).parse(await req.json());
    await connectDB();
    await Notification.updateMany({ userId: me._id, readAt: { $exists: false }, ...(b.all ? {} : { _id: { $in: b.ids ?? [] } }) }, { readAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

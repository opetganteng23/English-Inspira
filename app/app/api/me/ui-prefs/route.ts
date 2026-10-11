import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { User } from "@/models/User";
import { resolvePrefs, uiPrefsSchema } from "@/lib/ui-prefs";

export const dynamic = "force-dynamic";

/** Preferensi tampilan milik pengguna yang masuk (MTS v2.4 §27.8). Hanya pemilik. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, "Not signed in");
    return NextResponse.json(resolvePrefs((me as { uiPrefs?: unknown }).uiPrefs));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, "Not signed in");
    const patch = uiPrefsSchema.partial().parse(await req.json());
    const next = { ...resolvePrefs((me as { uiPrefs?: unknown }).uiPrefs), ...patch };
    if (next.quietStart === next.quietEnd) throw new HttpError(400, "Quiet hours need a different start and end time");
    await connectDB();
    await User.updateOne({ _id: me._id }, { uiPrefs: next });
    return NextResponse.json(next);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

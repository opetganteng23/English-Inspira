import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { staffViewer } from "@/lib/staff-view";
import { buildActivity } from "@/lib/activity";
import { audit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Timeline aktivitas (proctoring per soal). Hanya admin pusat dan admin akademik. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Attempt not found");
    await connectDB();
    const a = await Attempt.findById(params.id).select("userId").lean();
    if (!a) throw new HttpError(404, "Attempt not found");
    const { viewer, full } = await staffViewer(String(a.userId));
    if (!full) throw new HttpError(403, "Only program admins can open the activity timeline");
    const out = await buildActivity(params.id);
    const u = await User.findById(a.userId).select("name email").lean();
    await audit(viewer._id, "participant.activity_view", params.id, { userId: String(a.userId) });
    return NextResponse.json({ ...out, participant: { id: String(a.userId), name: u?.name ?? u?.email ?? "-", email: u?.email ?? "" } });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { ItpSession, ItpRegistration } from "@/models/Itp";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Schedule not found");
    await connectDB();
    const s = await ItpSession.findById(params.id).lean();
    if (!s) throw new HttpError(404, "Schedule not found");
    const regs = await ItpRegistration.find({ sessionId: s._id, status: { $ne: "cancelled" } }).sort({ createdAt: 1 }).lean();
    const users = new Map((await User.find({ _id: { $in: regs.map((r) => r.userId) } }).select("email phone").lean()).map((u) => [String(u._id), u]));
    return NextResponse.json({
      session: { id: String(s._id), title: s.title, date: s.date, place: s.place, quota: s.quota, registered: s.registered },
      roster: regs.map((r) => ({
        id: String(r._id), fullName: r.fullName, nikLast4: r.nikLast4, email: users.get(String(r.userId))?.email, phone: users.get(String(r.userId))?.phone ?? null,
        docStatus: r.docStatus, docNote: r.docNote ?? null, status: r.status, score: r.score ?? null, certificateId: r.certificateId ? String(r.certificateId) : null,
        idPhotoAssetId: String(r.idPhotoAssetId), facePhotoAssetId: String(r.facePhotoAssetId),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

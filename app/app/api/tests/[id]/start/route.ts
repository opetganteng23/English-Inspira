import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Test, Attempt } from "@/models/Test";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Tes tidak ditemukan");
    await connectDB();
    const test = await Test.findOne({ _id: params.id, active: true }).lean();
    if (!test) throw new HttpError(404, "Tes tidak ditemukan");

    // TODO Fase 4: selain trial, wajib punya entitlement aktif dan kurangi kuota.
    if (test.kind !== "trial" && user.role !== "admin") throw new HttpError(403, "Tes ini belum terbuka di akunmu");

    // Lanjutkan attempt yang berjalan (tahan refresh).
    const running = await Attempt.findOne({ userId: user._id, testId: test._id, status: "in_progress" });
    if (running) return NextResponse.json({ attemptId: String(running._id), resumed: true });

    // Free trial: 1 attempt per akun.
    if (test.kind === "trial" && (await Attempt.exists({ userId: user._id, kind: "trial" })))
      throw new HttpError(409, "Free trial hanya bisa dikerjakan sekali");

    const now = new Date();
    const attempt = await Attempt.create({
      userId: user._id, testId: test._id, kind: test.kind, startedAt: now, sectionStartedAt: now,
    });
    return NextResponse.json({ attemptId: String(attempt._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

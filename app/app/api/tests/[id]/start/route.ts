import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Test, Attempt } from "@/models/Test";
import { consumeGrant, refundGrant } from "@/lib/entitlements";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Tes tidak ditemukan");
    await connectDB();
    const test = await Test.findOne({ _id: params.id, active: true }).lean();
    if (!test) throw new HttpError(404, "Tes tidak ditemukan");

    // Lanjutkan attempt yang berjalan (tahan refresh).
    const running = await Attempt.findOne({ userId: user._id, testId: test._id, status: "in_progress" });
    if (running) return NextResponse.json({ attemptId: String(running._id), resumed: true });

    // Free trial: 1 attempt per akun.
    if (test.kind === "trial" && (await Attempt.exists({ userId: user._id, kind: "trial" })))
      throw new HttpError(409, "Free trial hanya bisa dikerjakan sekali");

    // Selain trial: wajib punya jatah (entitlement). Jatah dikurangi atomik hanya saat tes baru dimulai.
    let entId = null;
    if (test.kind !== "trial" && user.role !== "admin") {
      entId = await consumeGrant(user._id, "test", test.kind);
      if (!entId) throw new HttpError(403, "Kamu belum punya jatah untuk tes ini. Beli paket untuk membukanya.");
    }

    const now = new Date();
    let attempt;
    try {
      attempt = await Attempt.create({ userId: user._id, testId: test._id, kind: test.kind, startedAt: now, sectionStartedAt: now });
    } catch (err) {
      if (entId) await refundGrant(entId, "test", test.kind); // gagal membuat attempt: kembalikan jatah
      throw err;
    }
    return NextResponse.json({ attemptId: String(attempt._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

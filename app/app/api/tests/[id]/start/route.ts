import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { canStartTest } from "@/lib/test-access";
import { Test, Attempt } from "@/models/Test";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    await connectDB();
    const test = await Test.findOne({ _id: params.id, active: true }).lean();
    if (!test) throw new HttpError(404, "Test not found");
    if (test.kind === "quiz") throw new HttpError(409, "Quizzes are taken from learning units");

    // Lanjutkan attempt yang berjalan (tahan refresh); tidak perlu cek ulang aturan.
    const running = await Attempt.findOne({ userId: user._id, testId: test._id, status: "in_progress" });
    if (running) return NextResponse.json({ attemptId: String(running._id), resumed: true });

    const gate = canStartTest(user, test);
    if (!gate.ok) throw new HttpError(403, gate.reason ?? "This test cannot be taken yet");

    const now = new Date();
    const attempt = await Attempt.create({ userId: user._id, institutionId: user.institutionId, testId: test._id, kind: test.kind, startedAt: now, sectionStartedAt: now });
    return NextResponse.json({ attemptId: String(attempt._id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

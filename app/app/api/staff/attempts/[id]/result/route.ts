import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { staffViewer } from "@/lib/staff-view";
import { isReleased } from "@/lib/attempt-release";
import { attemptResult } from "@/lib/attempt-result";
import { audit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Laporan lengkap satu tes untuk staf: isi sama dengan laporan peserta (skor per bagian, kelemahan, narasi dan analisis AI). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Attempt not found");
    await connectDB();
    const attempt = await Attempt.findById(params.id);
    if (!attempt) throw new HttpError(404, "Attempt not found");
    const { viewer, target, full } = await staffViewer(String(attempt.userId));
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    if (!full && !isReleased(attempt)) return NextResponse.json({ error: "This result is not released yet.", held: true }, { status: 423 });
    const test = await Test.findById(attempt.testId).lean();
    if (!test) throw new HttpError(404, "Test not found");
    const res = await attemptResult(attempt, test as never);
    const hist = await Attempt.find({ userId: attempt.userId, status: "submitted", kind: { $nin: ["quiz", "section"] } }).sort({ finishedAt: -1 }).select("testId kind scoreEst finishedAt releaseAt").lean();
    const names = new Map((await Test.find({ _id: { $in: hist.map((h) => h.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    await audit(viewer._id, "participant.report_view", String(attempt._id), { userId: String(target._id), role: viewer.role });
    return NextResponse.json({
      ...res,
      staff: { participant: { id: String(target._id), name: target.name ?? target.email, email: target.email }, released: isReleased(attempt), held: !!attempt.heldByOrg && !attempt.releasedAt },
      staffTarget: target.targetScore ?? null,
      staffHistory: hist.filter((h) => full || isReleased(h)).map((h) => ({ id: String(h._id), kind: h.kind, name: names.get(String(h.testId)) ?? "-", status: "submitted", finishedAt: h.finishedAt ?? null, scoreEst: h.scoreEst ?? null, availableAt: null })),
    });
  } catch (e) {
    return handleError(e);
  }
}

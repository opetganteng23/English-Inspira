import { NextResponse } from "next/server";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { retryAnalysis, runAnalysis } from "@/lib/analysis";

/** Coba ulang analisis AI yang gagal (atau yang belum pernah berjalan). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    const st = (attempt.aiAnalysis as { status?: string } | undefined)?.status;
    if (st === "failed") await retryAnalysis(attempt._id);
    else if (!st) void runAnalysis(attempt._id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

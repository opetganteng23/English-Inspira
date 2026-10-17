import { NextResponse } from "next/server";
import { isReleased, exemptFromDelay } from "@/lib/attempt-release";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { attemptResult } from "@/lib/attempt-result";

export const dynamic = "force-dynamic";

/** Hasil tes yang sudah selesai: skor, topik, analisis, dan (selain diagnostic) pembahasan soal serta transkrip audio. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    if (!exemptFromDelay(user) && !isReleased(attempt)) return NextResponse.json({ error: "Your results are not released yet.", availableAt: attempt.releaseAt }, { status: 423 });
    return NextResponse.json(await attemptResult(attempt, test, user.role));
  } catch (e) {
    return handleError(e);
  }
}

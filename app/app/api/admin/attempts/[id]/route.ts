import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { connectDB } from "@/lib/db";
import { audit } from "@/lib/audit";
import { finalize } from "@/lib/attempts";
import { voidAttempt } from "@/lib/attempt-void";
import { Attempt, Test } from "@/models/Test";

const body = z.object({ action: z.enum(["terminate", "reset"]), reason: z.string().trim().min(5, "Enter a reason (at least 5 characters)").max(300) });

/**
 * Mitigasi percobaan yang nyangkut (status masih berjalan, peserta tidak bisa masuk lagi):
 * - terminate: tutup sekarang dan nilai jawaban yang sudah tersimpan (seperti waktu habis);
 * - reset: void (arsip, bisa dipulihkan) agar peserta bisa dijadwalkan dan tes ulang.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Attempt not found");
    const b = body.parse(await req.json());
    await connectDB();
    const attempt = await Attempt.findById(params.id);
    if (!attempt) throw new HttpError(404, "Attempt not found");
    if (b.action === "reset") {
      const r = await voidAttempt(params.id, String(attempt.userId), admin._id, b.reason);
      return NextResponse.json({ ok: true, ...r });
    }
    if (attempt.status !== "in_progress") throw new HttpError(409, "This attempt is already finished");
    const test = await Test.findById(attempt.testId);
    if (!test) throw new HttpError(404, "Test not found");
    const answered = attempt.answers.filter((a) => a.choice != null).length;
    await finalize(attempt as never, test as never);
    await audit(admin._id, "attempt.terminate", params.id, { userId: String(attempt.userId), testId: String(attempt.testId), section: attempt.sectionIdx, answered, score: attempt.scoreEst ?? null, reason: b.reason });
    return NextResponse.json({ ok: true, score: attempt.scoreEst ?? null, answered });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

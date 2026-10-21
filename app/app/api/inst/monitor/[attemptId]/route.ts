import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { diagnose } from "@/lib/monitor";
import { Attempt } from "@/models/Test";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Trace satu percobaan untuk portal institusi (hanya peserta institusi ini; skor & benar/salah disembunyikan bila hasil belum dirilis). */
export async function GET(req: Request, { params }: { params: { attemptId: string } }) {
  try {
    const { inst, full } = await instContext(req);
    if (!isValidObjectId(params.attemptId)) throw new HttpError(404, "Attempt not found");
    const a = await Attempt.findById(params.attemptId).select("userId releaseAt").lean();
    const u = a ? await User.findOne({ _id: a.userId, institutionId: inst._id }).select("_id").lean() : null;
    if (!a || !u) throw new HttpError(404, "Attempt not found");
    const d = await diagnose(params.attemptId);
    if (!full && a.releaseAt && +a.releaseAt > Date.now()) {
      d.attempt.scoreEst = null;
      d.sections = d.sections.map((s) => ({ ...s, correct: 0 }));
    }
    return NextResponse.json(d);
  } catch (e) {
    return handleError(e);
  }
}

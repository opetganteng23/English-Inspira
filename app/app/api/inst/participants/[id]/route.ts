import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext, memberResults } from "@/lib/inst";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Hasil satu peserta. Filter institusi ada di query (scoped), jadi peserta institusi lain selalu 404. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, scoped } = await instContext(req);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Participant not found");
    const m = await User.findOne(scoped({ _id: params.id })).select("name email targetScore goal").lean();
    if (!m) throw new HttpError(404, "Participant not found");
    await audit(user._id, "inst.participant_view", params.id); // akses inst_admin ke data individu dicatat (MTS §20)
    const l = (await memberResults([m._id])).get(String(m._id)) ?? [];
    return NextResponse.json({
      participant: { id: String(m._id), name: m.name, email: m.email, target: m.targetScore ?? null, goal: m.goal ?? null },
      attempts: l.map((a) => ({ id: String(a._id), kind: a.kind, scoreEst: a.scoreEst, sections: a.sectionScores, finishedAt: a.finishedAt })).reverse(),
    });
  } catch (e) {
    return handleError(e);
  }
}

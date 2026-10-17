import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { loadAttempt, finalize, isVersionError } from "@/lib/attempts";
import { Attempt } from "@/models/Test";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    try {
      await finalize(attempt, test); // idempoten
    } catch (e) {
      // Permintaan lain (mis. timer habis) sudah menyelesaikan percobaan ini lebih dulu: anggap berhasil.
      if (!isVersionError(e)) throw e;
      const done = await Attempt.findById(params.id).select("status scoreEst");
      if (done?.status !== "submitted") throw e;
      return NextResponse.json({ status: "submitted", scoreEst: done.scoreEst });
    }
    return NextResponse.json({ status: "submitted", scoreEst: attempt.scoreEst });
  } catch (e) {
    return handleError(e);
  }
}

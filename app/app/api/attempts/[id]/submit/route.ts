import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { loadAttempt, finalize } from "@/lib/attempts";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    await finalize(attempt, test); // idempoten
    return NextResponse.json({ status: "submitted", scoreEst: attempt.scoreEst });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { loadAttempt, advance } from "@/lib/attempts";

/** Selesaikan section sekarang dan pindah ke berikutnya (tidak bisa kembali). Section terakhir = submit. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    await advance(attempt, test);
    return NextResponse.json({ status: attempt.status });
  } catch (e) {
    return handleError(e);
  }
}

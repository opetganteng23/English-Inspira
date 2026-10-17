import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { loadAttempt, advanceSafely } from "@/lib/attempts";

/** Selesaikan section sekarang dan pindah ke berikutnya (tidak bisa kembali). Section terakhir = submit. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    const status = await advanceSafely(attempt, test);
    return NextResponse.json({ status });
  } catch (e) {
    return handleError(e);
  }
}

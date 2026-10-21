import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { diagnose } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/** Trace satu percobaan: diagnosis otomatis, ringkasan per bagian, dan jeda koneksi. */
export async function GET(_req: Request, { params }: { params: { attemptId: string } }) {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await diagnose(params.attemptId));
  } catch (e) {
    return handleError(e);
  }
}

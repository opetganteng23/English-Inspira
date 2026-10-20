import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { staffDashboard } from "@/lib/staff-view";

export const dynamic = "force-dynamic";

/** Dasbor peserta untuk admin pusat (lengkap) dan admin institusi (peserta sendiri, hasil yang sudah dirilis). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await staffDashboard(params.id));
  } catch (e) {
    return handleError(e);
  }
}

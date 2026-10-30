import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { scheduleChanges } from "@/lib/schedule-changes";

export const dynamic = "force-dynamic";

/** Rekap perubahan jadwal (pindah sesi, perpanjangan waktu) untuk papan jadwal. ?institution= membatasi ke satu institusi. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const inst = new URL(req.url).searchParams.get("institution");
    const r = await scheduleChanges(params.id, { scope: inst && isValidObjectId(inst) ? { institutionId: inst } : undefined });
    if (!r) throw new HttpError(404, "Test not found");
    return NextResponse.json({
      people: r.people,
      changes: r.changes.slice(-500).reverse().map((c) => ({ userId: c.userId, name: c.name, email: c.email, type: c.type, from: c.from, to: c.to, at: c.at, by: c.by, reason: c.reason, source: c.source, status: c.status })),
      total: r.changes.length,
    });
  } catch (e) {
    return handleError(e);
  }
}

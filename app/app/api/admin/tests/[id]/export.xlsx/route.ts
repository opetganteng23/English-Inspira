import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { buildTestExport } from "@/lib/test-export";

export const dynamic = "force-dynamic";

/** Unduh hasil satu tes (Excel): semua peserta terjadwal dan yang mengerjakan, beserta skor, jadwal, status, dan rekap. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const session = new URL(req.url).searchParams.get("session");
    if (session && !isValidObjectId(session)) throw new HttpError(404, "Session not found");
    const out = await buildTestExport(params.id, new Date(), session ?? undefined);
    if (!out) throw new HttpError(404, session ? "Session not found" : "Test not found");
    await audit(admin._id, "test.results_export", params.id, { rows: out.rows, session: session ?? null });
    const file = `results-${out.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").replace(/-{2,}/g, "-").slice(0, 90) || "test"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(new Uint8Array(out.buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

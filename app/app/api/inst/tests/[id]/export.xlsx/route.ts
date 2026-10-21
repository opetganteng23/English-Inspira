import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { audit } from "@/lib/audit";
import { buildTestExport } from "@/lib/test-export";
import { analyticsTests } from "@/lib/analytics-tests";

export const dynamic = "force-dynamic";

/** Hasil dan kehadiran satu tes (Excel) untuk portal institusi: hanya peserta institusi ini; skor yang belum dirilis tidak ditampilkan untuk admin institusi. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, inst, full } = await instContext(req);
    if (!isValidObjectId(params.id) || !(await analyticsTests(String(inst._id))).some((t) => t.id === params.id)) throw new HttpError(404, "Test not found");
    const q = new URL(req.url).searchParams, session = q.get("session");
    if (session && !isValidObjectId(session)) throw new HttpError(404, "Session not found");
    const out = await buildTestExport(params.id, new Date(), session ?? undefined, { institutionId: String(inst._id), releasedOnly: !full, branch: q.get("branch") || undefined, age: q.get("age") || undefined });
    if (!out) throw new HttpError(404, "Test not found");
    await audit(user._id, "inst.results_export", params.id, { institution: String(inst._id), rows: out.rows });
    const file = `results-${out.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 90) || "test"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(new Uint8Array(out.buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

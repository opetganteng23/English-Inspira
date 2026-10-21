import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { audit } from "@/lib/audit";
import { buildExecSummary } from "@/lib/exec-summary";
import { analyticsTests } from "@/lib/analytics-tests";

export const dynamic = "force-dynamic";

/** Executive summary (.pptx) untuk portal institusi: hanya peserta institusi ini; admin institusi hanya hasil yang sudah dirilis. ?session, ?branch, ?age. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, inst, full } = await instContext(req);
    if (!isValidObjectId(params.id) || !(await analyticsTests(String(inst._id))).some((t) => t.id === params.id)) throw new HttpError(404, "Test not found");
    const q = new URL(req.url).searchParams, session = q.get("session"), t = Number(q.get("target"));
    if (session && !isValidObjectId(session)) throw new HttpError(404, "Session not found");
    const out = await buildExecSummary(params.id, { sessionId: session ?? undefined, target: t >= 310 && t <= 677 ? Math.round(t) : undefined, scope: { institutionId: String(inst._id), releasedOnly: !full, branch: q.get("branch") || undefined, age: q.get("age") || undefined } });
    if (!out) throw new HttpError(404, "Test not found");
    await audit(user._id, "inst.summary_export", params.id, { institution: String(inst._id) });
    const file = `executive-summary-${out.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 90) || "test"}-${new Date().toISOString().slice(0, 10)}.pptx`;
    return new Response(new Uint8Array(out.buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

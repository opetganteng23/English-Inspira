import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { buildExecSummary } from "@/lib/exec-summary";
import { scopeFromQuery } from "@/lib/test-export";

export const dynamic = "force-dynamic";

/** Executive summary (.pptx): ?session=<id> untuk satu sesi/hari, tanpa itu keseluruhan. ?target= skor target (bawaan 550). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Test not found");
    const q = new URL(req.url).searchParams, session = q.get("session"), t = Number(q.get("target"));
    if (session && !isValidObjectId(session)) throw new HttpError(404, "Session not found");
    const out = await buildExecSummary(params.id, { sessionId: session ?? undefined, target: t >= 310 && t <= 677 ? Math.round(t) : undefined, scope: { institutionId: q.get("institution") || undefined, ...scopeFromQuery(q) } });
    if (!out) throw new HttpError(404, session ? "Session not found" : "Test not found");
    await audit(admin._id, "test.summary_export", params.id, { session: session ?? null });
    const file = `executive-summary-${out.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").replace(/-{2,}/g, "-").slice(0, 90) || "test"}-${new Date().toISOString().slice(0, 10)}.pptx`;
    return new Response(new Uint8Array(out.buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

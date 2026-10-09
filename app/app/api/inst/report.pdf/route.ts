import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { buildInstSummary } from "@/lib/inst-summary";
import { institutionReportPdf } from "@/lib/pdf";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Laporan PDF kelompok (agregat). Setiap unduhan dicatat di audit log. */
export async function GET(req: Request) {
  try {
    const { user, inst, scoped } = await instContext(req);
    const pdf = await institutionReportPdf((await buildInstSummary(inst, scoped)) as never);
    await audit(user._id, "inst.report_pdf", String(inst._id));
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="laporan-${inst.code}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

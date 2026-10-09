import { NextResponse } from "next/server";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { loadPdf } from "@/lib/pdf-access";
import { runAnalysisById } from "@/lib/analysis";
import { Analysis } from "@/models/Learning";

/**
 * Analisis dari nilai TERVERIFIKASI (pdfAdapter). Hanya angka terstruktur yang dipakai; file tidak pernah dikirim ke AI.
 * Hasil terbatas pada skor per section. Tidak mengubah level atau study plan (pintu 2 bersifat informatif).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    const p = await loadPdf(params.id, me, { owner: true });
    if (p.status !== "verified" && p.status !== "analyzed") throw new HttpError(409, "Verify the scores before analyzing");
    let a = p.analysisId ? await Analysis.findById(p.analysisId) : null;
    if (a && a.status === "failed") { a.status = "calculated"; a.claimedAt = undefined; await a.save(); }
    if (!a) {
      a = await Analysis.create({ userId: me._id, institutionId: me.institutionId, sourceKind: "pdf", pdfId: p._id, status: "calculated", calculated: { scores: p.verified } });
      p.analysisId = a._id; p.status = "analyzed"; await p.save();
    }
    await audit(me._id, "pdf.analyze", params.id);
    void runAnalysisById(a._id);
    return NextResponse.json({ ok: true, analysisId: String(a._id) }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}

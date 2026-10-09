import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { loadPdf } from "@/lib/pdf-access";
import { verifyScores } from "@/lib/pdf-import";
import { pdfBucket } from "@/models/Pdf";
import { Analysis } from "@/models/Learning";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant", "coach", "admin"]);
    const p = await loadPdf(params.id, me);
    const a = p.analysisId ? await Analysis.findById(p.analysisId).select("status narrative engine").lean() : null;
    return NextResponse.json({
      id: String(p._id), filename: p.filename, status: p.status, template: p.template ?? "unknown", parsed: p.parsed ?? {}, verified: p.verified ?? {}, hasFile: !!p.fileId, analysisId: p.analysisId ? String(p.analysisId) : null, createdAt: p.createdAt,
      analysis: a ? { status: a.status, engine: a.engine ?? null, narrative: a.status === "ready" ? a.narrative : null } : null,
    });
  } catch (e) {
    return handleError(e);
  }
}

const body = z.object({
  listening: z.number().int().optional(), structure: z.number().int().optional(), reading: z.number().int().optional(), total: z.number().int().optional(),
});

/** Layar verifikasi: peserta mengonfirmasi/mengoreksi nilai yang terbaca sebelum dianalisis. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    const p = await loadPdf(params.id, me, { owner: true });
    if (p.status === "analyzed") throw new HttpError(409, "Sudah dianalisis. Unggah ulang bila ada koreksi.");
    const r = verifyScores(body.parse(await req.json()));
    if (!r.ok) throw new HttpError(400, r.error);
    p.verified = r.scores; p.status = "verified";
    await p.save();
    await audit(me._id, "pdf.verify", params.id);
    return NextResponse.json({ ok: true, verified: r.scores });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Nilai harus berupa bilangan bulat" }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus berkas dan catatannya oleh pemilik (hak hapus). Analisis yang sudah jadi ikut dihapus bersama catatannya. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    const p = await loadPdf(params.id, me, { owner: true });
    if (p.fileId) await (await pdfBucket()).delete(p.fileId).catch(() => {});
    await p.deleteOne();
    await audit(me._id, "pdf.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

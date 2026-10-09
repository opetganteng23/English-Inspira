import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadPdf } from "@/lib/pdf-access";
import { pdfBucket } from "@/models/Pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Unduh PDF asli: pemilik, coach se-institusi, admin. Tidak di-cache, tidak dapat di-embed. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant", "coach", "admin"]);
    const p = await loadPdf(params.id, me);
    if (!p.fileId) throw new HttpError(410, "Berkas sudah dihapus sesuai masa retensi. Nilai terverifikasi tetap tersimpan.");
    const chunks: Buffer[] = [];
    for await (const c of (await pdfBucket()).openDownloadStream(p.fileId)) chunks.push(c as Buffer);
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${(p.filename ?? "hasil.pdf").replace(/"/g, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    return handleError(e);
  }
}

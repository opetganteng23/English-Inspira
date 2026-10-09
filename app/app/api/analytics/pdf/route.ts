import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { getParam } from "@/lib/config";
import { audit } from "@/lib/audit";
import { isPdf, MAX_PDF_BYTES, parseItpScores } from "@/lib/pdf-import";
import { limit } from "@/lib/ratelimit";
import { PdfImport, pdfBucket } from "@/models/Pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Daftar PDF milik sendiri. */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    const list = await PdfImport.find({ userId: me._id }).sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({
      imports: list.map((p) => ({ id: String(p._id), filename: p.filename ?? "", status: p.status, template: p.template ?? "unknown", parsed: p.parsed ?? {}, verified: p.verified ?? {}, hasFile: !!p.fileId, analysisId: p.analysisId ? String(p.analysisId) : null, createdAt: p.createdAt })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Unggah PDF: hanya PDF (magic bytes `%PDF`), maks 10 MB, disimpan di GridFS bucket `pdf`, teks diekstrak dengan pdf-parse.
 * Nilai yang terbaca baru dipakai setelah diverifikasi peserta. File TIDAK pernah dikirim ke Claude.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    await limit("verifyIp", `pdf:${me._id}`);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "Maximum 10 MB");
    const buf = Buffer.from(await file.arrayBuffer());
    if (!isPdf(buf)) throw new HttpError(415, "The file is not a valid PDF");

    let text = "";
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try { text = (await parser.getText()).text ?? ""; } finally { await parser.destroy(); }
    } catch (e) { console.error("[pdf] extraction failed:", (e as Error).message); /* rusak/terenkripsi/scan: lanjut tanpa teks, peserta mengisi manual */ }
    const { template, scores } = parseItpScores(text);

    await connectDB();
    const bucket = await pdfBucket();
    const name = (file.name || "result.pdf").replace(/[^\w.\- ]/g, "_").slice(0, 120);
    const up = bucket.openUploadStream(name, { metadata: { userId: String(me._id) } });
    await new Promise<void>((resolve, reject) => { Readable.from(buf).pipe(up).on("finish", () => resolve()).on("error", reject); });

    const days = await getParam("pdf_retention_days");
    const rec = await PdfImport.create({
      userId: me._id, institutionId: me.institutionId, fileId: up.id, filename: name, size: buf.length, status: "extracted", template, parsed: scores,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    });
    await audit(me._id, "pdf.upload", String(rec._id), { template });
    return NextResponse.json({ id: String(rec._id), template, parsed: scores, textFound: text.trim().length > 0 }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { isPdf, MAX_PDF_BYTES } from "@/lib/pdf-import";
import { MaterialFile } from "@/models/Material";
import { pdfBucket } from "@/models/Pdf";

export const runtime = "nodejs";

/** Unggah lampiran PDF untuk materi (penulis: admin, coach, inst_admin). PDF saja (magic bytes), maks 10 MB. */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["admin", "coach", "inst_admin"]);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "Maximum 10 MB");
    const buf = Buffer.from(await file.arrayBuffer());
    if (!isPdf(buf)) throw new HttpError(415, "The file is not a valid PDF");
    await connectDB();
    const name = (file.name || "attachment.pdf").replace(/[^\w.\- ]/g, "_").slice(0, 120);
    const up = (await pdfBucket()).openUploadStream(name, { metadata: { kind: "material", uploader: String(me._id) } });
    await new Promise<void>((res, rej) => { Readable.from(buf).pipe(up).on("finish", () => res()).on("error", rej); });
    const rec = await MaterialFile.create({ fileId: up.id, filename: name, size: buf.length, uploaderId: me._id });
    return NextResponse.json({ id: String(rec._id), url: `/api/material-files/${rec._id}`, filename: name }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

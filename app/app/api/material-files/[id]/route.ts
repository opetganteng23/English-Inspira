import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { MaterialFile } from "@/models/Material";
import { pdfBucket } from "@/models/Pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Unduh lampiran materi: pengguna yang sudah masuk. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, "Not signed in");
    if (!isValidObjectId(params.id)) throw new HttpError(404, "File not found");
    await connectDB();
    const f = await MaterialFile.findById(params.id).lean();
    if (!f) throw new HttpError(404, "File not found");
    const chunks: Buffer[] = [];
    for await (const c of (await pdfBucket()).openDownloadStream(f.fileId)) chunks.push(c as Buffer);
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${(f.filename ?? "attachment.pdf").replace(/"/g, "")}"`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    return handleError(e);
  }
}

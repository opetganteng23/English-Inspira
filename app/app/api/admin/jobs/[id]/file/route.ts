import { isValidObjectId } from "mongoose";
import { Readable } from "node:stream";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { openReport } from "@/lib/bg-jobs";
import { Job } from "@/models/Job";

export const dynamic = "force-dynamic";

/** Unduh laporan yang dibuat di latar. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Report not found");
    await connectDB();
    const j = await Job.findById(params.id).lean();
    if (!j?.fileId) throw new HttpError(404, "Report not found or already removed");
    const type = j.kind === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const stream = Readable.toWeb(await openReport(j.fileId)) as ReadableStream;
    return new Response(stream, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${j.fileName}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

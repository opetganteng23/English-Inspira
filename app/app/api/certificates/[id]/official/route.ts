import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { readCertFile } from "@/lib/cert-files";
import { audit } from "@/lib/audit";
import { Certificate } from "@/models/Itp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tampilkan (inline) atau unduh (?download=1) berkas sertifikat TOEFL resmi dari pihak ketiga. Hanya pemilik atau admin. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Document not found");
    await connectDB();
    const c = await Certificate.findById(params.id).lean();
    if (!c || (String(c.userId) !== String(user._id) && user.role !== "admin") || !c.officialFile?.fileId) throw new HttpError(404, "Document not found");
    const buf = await readCertFile(c.officialFile.fileId);
    const download = new URL(req.url).searchParams.get("download") === "1";
    if (user.role === "admin" && String(c.userId) !== String(user._id)) await audit(user._id, "itp.official_file_view", String(c._id));
    const name = (c.officialFile.name ?? "certificate").replace(/["\r\n]/g, "");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": c.officialFile.mime ?? "application/octet-stream", // dari isi berkas saat diunggah, bukan dari klien
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

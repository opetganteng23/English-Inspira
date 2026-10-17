import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { MAX_CERT_BYTES, sniffCertFile, saveCertFile, deleteCertFile } from "@/lib/cert-files";
import { Certificate } from "@/models/Itp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function certFor(registrationId: string) {
  if (!isValidObjectId(registrationId)) throw new HttpError(404, "Registration not found");
  await connectDB();
  const c = await Certificate.findOne({ registrationId });
  if (!c) throw new HttpError(409, "Enter the official scores first. The certificate record is created when the scores are saved.");
  return c;
}

/** Lampirkan berkas sertifikat TOEFL resmi dari pihak ketiga (PDF/JPG/PNG, maks 10 MB). Mengganti berkas sebelumnya. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const c = await certFor(params.id);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    if (file.size > MAX_CERT_BYTES) throw new HttpError(413, "Maximum 10 MB");
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffCertFile(buf);
    if (!kind) throw new HttpError(415, "Only PDF, JPG, or PNG files are accepted");
    const base = (file.name || "certificate").replace(/\.[^.]+$/, "").replace(/[^\w.\- ]/g, "_").slice(0, 100) || "certificate";
    const name = `${base}.${kind.ext}`;
    const fileId = await saveCertFile(buf, name, { certificateId: String(c._id), userId: String(c.userId) });
    const old = c.officialFile?.fileId;
    c.officialFile = { fileId, name, mime: kind.mime, size: buf.length, uploadedAt: new Date(), uploadedBy: admin._id };
    await c.save();
    if (old) await deleteCertFile(old);
    await audit(admin._id, "itp.official_file", String(c._id), { name, size: buf.length });
    return NextResponse.json({ ok: true, name, size: buf.length, mime: kind.mime });
  } catch (e) {
    return handleError(e);
  }
}

/** Hapus berkas sertifikat resmi yang terlampir (catatan sertifikat dan skor tetap ada). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const c = await certFor(params.id);
    if (!c.officialFile?.fileId) throw new HttpError(404, "No official file attached");
    await deleteCertFile(c.officialFile.fileId);
    c.officialFile = undefined;
    await c.save();
    await audit(admin._id, "itp.official_file_delete", String(c._id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

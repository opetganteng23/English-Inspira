import { isValidObjectId } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { audit } from "./audit";
import { PdfImport } from "@/models/Pdf";

type Viewer = { _id: unknown; role: string; institutionId?: unknown };

/**
 * Akses ke PDF (MTS §14): pemilik, coach se-institusi, dan admin. inst_admin TIDAK boleh (data individual).
 * Akses oleh bukan pemilik dicatat di audit log. Selain itu 404 agar keberadaan file tidak bocor.
 */
export async function loadPdf(id: string, viewer: Viewer, opts: { owner?: boolean } = {}) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Berkas tidak ditemukan");
  await connectDB();
  const p = await PdfImport.findById(id);
  if (!p) throw new HttpError(404, "Berkas tidak ditemukan");
  const isOwner = String(p.userId) === String(viewer._id);
  const staff = viewer.role === "admin" || (viewer.role === "coach" && !!viewer.institutionId && String(p.institutionId) === String(viewer.institutionId));
  if (!isOwner && (opts.owner || !staff)) throw new HttpError(404, "Berkas tidak ditemukan");
  if (!isOwner) await audit(viewer._id as never, "pdf.view", id);
  return p;
}

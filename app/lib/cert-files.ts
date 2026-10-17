import mongoose from "mongoose";
import type { Types } from "mongoose";
import { Readable } from "node:stream";
import { connectDB } from "./db";
import { sniffImage } from "./files";

/** Berkas sertifikat TOEFL resmi dari pihak ketiga: PDF, JPG, atau PNG, maks 10 MB. Jenisnya ditentukan dari isi berkas, bukan ekstensi atau MIME dari klien. */
export const MAX_CERT_BYTES = 10 * 1024 * 1024;

export function sniffCertFile(b: Buffer): { mime: "application/pdf" | "image/jpeg" | "image/png"; ext: "pdf" | "jpg" | "png" } | null {
  if (b.length > 4 && b.subarray(0, 4).toString("latin1") === "%PDF") return { mime: "application/pdf", ext: "pdf" };
  const img = sniffImage(b);
  if (img === "image/jpeg") return { mime: "image/jpeg", ext: "jpg" };
  if (img === "image/png") return { mime: "image/png", ext: "png" };
  return null;
}

export async function certBucket() {
  await connectDB();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "certfiles" });
}

export async function saveCertFile(buf: Buffer, name: string, meta: Record<string, unknown>): Promise<Types.ObjectId> {
  const up = (await certBucket()).openUploadStream(name, { metadata: meta });
  await new Promise<void>((resolve, reject) => { Readable.from(buf).pipe(up).on("finish", () => resolve()).on("error", reject); });
  return up.id as Types.ObjectId;
}

export async function readCertFile(id: Types.ObjectId | string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of (await certBucket()).openDownloadStream(new mongoose.Types.ObjectId(String(id)))) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

export async function deleteCertFile(id: Types.ObjectId | string) {
  await (await certBucket()).delete(new mongoose.Types.ObjectId(String(id))).catch(() => {});
}

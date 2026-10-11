import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { HttpError } from "./rbac";
import { isMp3 } from "./files";
import { audioBucket } from "./audio-store";

export const AUDIO_MAX_BYTES = 15 * 1024 * 1024;
export const AUDIO_MAX_DURATION = 10 * 60;

/** Validasi berkas MP3 (ekstensi, ukuran, magic bytes, durasi terbaca, maks 10 menit). Dipakai unggah baru dan ganti berkas. */
export async function readMp3(file: unknown) {
  if (!(file instanceof File)) throw new HttpError(400, "A file is required");
  if (!file.name.toLowerCase().endsWith(".mp3")) throw new HttpError(415, "Only .mp3 files");
  if (file.size > AUDIO_MAX_BYTES) throw new HttpError(413, "Maximum 15 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!isMp3(buf)) throw new HttpError(415, "The file content is not a valid MP3"); // cek magic bytes
  const { parseBuffer } = await import("music-metadata");
  let durationSec = 0;
  try {
    durationSec = Math.round((await parseBuffer(buf, { mimeType: "audio/mpeg" })).format.duration ?? 0);
  } catch {
    throw new HttpError(415, "The audio file is damaged or cannot be read");
  }
  if (!durationSec) throw new HttpError(415, "Audio duration cannot be read");
  if (durationSec > AUDIO_MAX_DURATION) throw new HttpError(413, "Maximum duration is 10 minutes");
  const sha256 = createHash("sha256").update(buf).digest("hex");
  return { buf, durationSec, sha256, name: file.name };
}

export async function storeMp3(buf: Buffer, name: string, sha256: string) {
  const up = (await audioBucket()).openUploadStream(name, { metadata: { sha256 } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buf).pipe(up).on("finish", () => resolve()).on("error", reject);
  });
  return up.id;
}

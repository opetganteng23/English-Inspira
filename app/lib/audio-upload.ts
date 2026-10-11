import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { HttpError } from "./rbac";
import { isMp3, isWav } from "./files";
import { audioBucket } from "./audio-store";

export const AUDIO_MAX_BYTES = 15 * 1024 * 1024;
export const WAV_MAX_BYTES = 30 * 1024 * 1024; // WAV tidak terkompresi: batas lebih longgar, tetap dibatasi
export const AUDIO_MAX_DURATION = 10 * 60;

/**
 * Validasi berkas audio MP3 atau WAV (ekstensi, ukuran, magic bytes, durasi terbaca, maks 10 menit).
 * Dipakai unggah baru dan ganti berkas.
 */
export async function readAudio(file: unknown) {
  if (!(file instanceof File)) throw new HttpError(400, "A file is required");
  const lower = file.name.toLowerCase();
  const wav = lower.endsWith(".wav");
  if (!wav && !lower.endsWith(".mp3")) throw new HttpError(415, "Only .mp3 or .wav files");
  if (file.size > (wav ? WAV_MAX_BYTES : AUDIO_MAX_BYTES)) throw new HttpError(413, wav ? "Maximum 30 MB for WAV. Export it as MP3 to make it smaller." : "Maximum 15 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  if (wav ? !isWav(buf) : !isMp3(buf)) throw new HttpError(415, `The file content is not a valid ${wav ? "WAV" : "MP3"}`); // cek magic bytes
  const mime = wav ? "audio/wav" : "audio/mpeg";
  const { parseBuffer } = await import("music-metadata");
  let durationSec = 0;
  try {
    durationSec = Math.round((await parseBuffer(buf, { mimeType: mime })).format.duration ?? 0);
  } catch {
    throw new HttpError(415, "The audio file is damaged or cannot be read");
  }
  if (!durationSec) throw new HttpError(415, "Audio duration cannot be read");
  if (durationSec > AUDIO_MAX_DURATION) throw new HttpError(413, "Maximum duration is 10 minutes");
  const sha256 = createHash("sha256").update(buf).digest("hex");
  return { buf, durationSec, sha256, name: file.name, mime };
}
export const readMp3 = readAudio;

/** Bentuk gelombang dari klien: maksimal 300 angka 0-100. Selain itu dibuang diam-diam (hanya tampilan). */
export function parsePeaks(raw: unknown): number[] | undefined {
  try {
    const a = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(a) || a.length < 10 || a.length > 300) return undefined;
    return a.map((n) => Math.max(0, Math.min(100, Math.round(Number(n)))));
  } catch { return undefined; }
}

export function parseMarkers(raw: unknown, durationSec: number) {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 50) throw new HttpError(400, "Maximum 50 timestamps per audio");
  const out = raw.map((m) => ({ t: Math.round(Number((m as { t?: unknown }).t) * 10) / 10, label: String((m as { label?: unknown }).label ?? "").trim().slice(0, 80) }));
  if (out.some((m) => !Number.isFinite(m.t) || m.t < 0 || m.t > durationSec || !m.label)) throw new HttpError(400, `Each timestamp needs a label and a time between 0 and ${durationSec} seconds`);
  return out.sort((a, b) => a.t - b.t);
}

export async function storeMp3(buf: Buffer, name: string, sha256: string) {
  const up = (await audioBucket()).openUploadStream(name, { metadata: { sha256 } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buf).pipe(up).on("finish", () => resolve()).on("error", reject);
  });
  return up.id;
}

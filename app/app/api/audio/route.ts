import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { isMp3 } from "@/lib/files";
import { audioBucket } from "@/lib/audio-store";
import { Audio } from "@/models/Audio";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_DURATION = 10 * 60;

export async function POST(req: Request) {
  try {
    const user = await requireRole(["admin"]);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "File wajib diisi");
    if (!file.name.toLowerCase().endsWith(".mp3")) throw new HttpError(415, "Hanya file .mp3");
    if (file.size > MAX_BYTES) throw new HttpError(413, "Maksimal 15 MB");

    const buf = Buffer.from(await file.arrayBuffer());
    if (!isMp3(buf)) throw new HttpError(415, "Isi file bukan MP3 yang valid"); // cek magic bytes

    const { parseBuffer } = await import("music-metadata");
    let durationSec = 0;
    try {
      durationSec = Math.round((await parseBuffer(buf, { mimeType: "audio/mpeg" })).format.duration ?? 0);
    } catch {
      throw new HttpError(415, "File audio rusak atau tidak bisa dibaca");
    }
    if (!durationSec) throw new HttpError(415, "Durasi audio tidak terbaca");
    if (durationSec > MAX_DURATION) throw new HttpError(413, "Durasi maksimal 10 menit");

    const sha256 = createHash("sha256").update(buf).digest("hex");
    const dup = await Audio.findOne({ sha256 }).select("_id");
    if (dup) return NextResponse.json({ audioId: String(dup._id), deduped: true });

    const bucket = await audioBucket();
    const up = bucket.openUploadStream(file.name, { metadata: { sha256 } });
    await new Promise<void>((resolve, reject) => {
      Readable.from(buf).pipe(up).on("finish", () => resolve()).on("error", reject);
    });

    const title = String(form.get("title") ?? "").trim() || file.name.replace(/\.mp3$/i, "");
    const audio = await Audio.create({
      gridFsId: up.id, title, size: buf.length, durationSec, sha256,
      transcript: String(form.get("transcript") ?? "") || undefined, uploaderId: user._id,
    });
    return NextResponse.json({ audioId: String(audio._id), durationSec }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

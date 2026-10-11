import { Readable } from "node:stream";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audioBucket, verifyAudioToken } from "@/lib/audio-store";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { Audio } from "@/models/Audio";
import { QuestionGroup } from "@/models/Question";
import { Material } from "@/models/Material";
import { readAudio, storeMp3, parsePeaks, parseMarkers } from "@/lib/audio-upload";
import { NextResponse } from "next/server";

/** Streaming dengan HTTP Range. Akses: signed URL (peserta saat tes) atau sesi admin. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) return new Response("Not found", { status: 404 });
  await connectDB();

  const tok = await verifyAudioToken(new URL(req.url).searchParams.get("token"));
  let allowed = tok?.audioId === params.id;
  let isAdmin = false;
  if (!allowed) {
    const u = await getCurrentUser();
    isAdmin = !!u && CONTENT_ROLES.includes(u.role);
    allowed = isAdmin;
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const audio = await Audio.findById(params.id).lean();
  if (!audio) return new Response("Not found", { status: 404 });

  const size = audio.size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  let start = 0, end = size - 1, status = 200;
  if (range) {
    if (range[1] === "" && range[2] !== "") { start = Math.max(0, size - Number(range[2])); }
    else { start = Number(range[1]); if (range[2] !== "") end = Math.min(Number(range[2]), size - 1); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }

  const bucket = await audioBucket();
  const stream = bucket.openDownloadStream(audio.gridFsId, { start, end: end + 1 });
  const headers: Record<string, string> = {
    "Content-Type": audio.mime || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers });
}

/** Ubah judul dan/atau transkrip. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CONTENT_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Audio not found");
    const body = await req.json().catch(() => ({}));
    const set: Record<string, string> = {};
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) throw new HttpError(400, "Title cannot be empty");
      if (t.length > 120) throw new HttpError(400, "Title is too long (maximum 120 characters)");
      set.title = t;
    }
    if (typeof body.transcript === "string") {
      if (body.transcript.length > 20000) throw new HttpError(400, "Transcript is too long (maximum 20,000 characters)");
      set.transcript = body.transcript;
    }
    if (body.kind !== undefined) {
      if (!["short_conversation", "longer_conversation", "talk", "other"].includes(body.kind)) throw new HttpError(400, "Invalid audio kind");
      set.kind = body.kind;
    }
    if (Array.isArray(body.markers)) {
      const cur = await Audio.findById(params.id).select("durationSec").lean();
      if (!cur) throw new HttpError(404, "Audio not found");
      (set as Record<string, unknown>).markers = parseMarkers(body.markers, cur.durationSec);
    }
    if (body.peaks !== undefined) (set as Record<string, unknown>).peaks = parsePeaks(body.peaks) ?? [];
    if (typeof body.description === "string") set.description = body.description.trim().slice(0, 500);
    if (typeof body.source === "string") set.source = body.source.trim().slice(0, 200);
    await connectDB();
    const a = await Audio.findByIdAndUpdate(params.id, { $set: set }, { new: true });
    if (!a) throw new HttpError(404, "Audio not found");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

/** Ganti berkas MP3 tanpa memutus tautan: soal dan materi tetap memakai id yang sama. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CONTENT_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Audio not found");
    await connectDB();
    const a = await Audio.findById(params.id);
    if (!a) throw new HttpError(404, "Audio not found");
    const fd = await req.formData();
    const { buf, durationSec, sha256, name, mime } = await readAudio(fd.get("file"));
    const same = await Audio.findOne({ sha256, _id: { $ne: a._id } }).select("title");
    if (same) throw new HttpError(409, `An identical file already exists as "${same.title}". Use that audio instead.`);
    const oldId = a.gridFsId;
    const gridFsId = await storeMp3(buf, name, sha256);
    a.gridFsId = gridFsId; a.mime = mime; a.set("peaks", parsePeaks(fd.get("peaks")) ?? []); a.set("markers", (a.markers ?? []).filter((m) => (m.t ?? 0) <= durationSec)); a.size = buf.length; a.durationSec = durationSec; a.sha256 = sha256;
    await a.save();
    await (await audioBucket()).delete(oldId).catch(() => {}); // berkas lama dibersihkan; kegagalan di sini tidak membatalkan penggantian
    return NextResponse.json({ ok: true, durationSec });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(CONTENT_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Audio not found");
    await connectDB();
    const a = await Audio.findById(params.id);
    if (!a) throw new HttpError(404, "Audio not found");
    // Audio yang masih dipakai grup soal atau materi tidak boleh dihapus (akan memutus pemutar).
    const [groups, materials] = await Promise.all([
      QuestionGroup.countDocuments({ audioId: a._id }),
      Material.countDocuments({ contentHtml: { $regex: `data-audio-id="${String(a._id)}"` } }),
    ]);
    if (groups || materials) throw new HttpError(409, `The audio is still used by ${[groups && `${groups} question group${groups > 1 ? "s" : ""}`, materials && `${materials} material${materials > 1 ? "s" : ""}`].filter(Boolean).join(" and ")}. Remove it there first.`);
    await (await audioBucket()).delete(a.gridFsId);
    await a.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

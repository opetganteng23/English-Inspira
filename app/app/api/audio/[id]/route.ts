import { Readable } from "node:stream";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audioBucket, verifyAudioToken } from "@/lib/audio-store";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Audio } from "@/models/Audio";
import { QuestionGroup } from "@/models/Question";
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
    isAdmin = u?.role === "admin";
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
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    await connectDB();
    const a = await Audio.findByIdAndUpdate(
      params.id,
      { ...(typeof body.title === "string" && { title: body.title.trim() }), ...(typeof body.transcript === "string" && { transcript: body.transcript }) },
      { new: true }
    );
    if (!a) throw new HttpError(404, "Audio tidak ditemukan");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const a = await Audio.findById(params.id);
    if (!a) throw new HttpError(404, "Audio tidak ditemukan");
    // Audio yang masih dipakai grup soal tidak boleh dihapus.
    const used = await QuestionGroup.exists({ audioId: a._id });
    if (used) throw new HttpError(409, "Audio masih dipakai soal");
    await (await audioBucket()).delete(a.gridFsId);
    await a.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

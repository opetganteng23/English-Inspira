import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { signAudioToken } from "@/lib/audio-store";
import { Question, QuestionGroup } from "@/models/Question";
import { Attempt } from "@/models/Test";
import { Audio } from "@/models/Audio";

const ROLES = ["participant", "admin", "inst_admin"] as const;

async function guard(id: string, audioId: string) {
  const user = await requireRole([...ROLES]);
  if (!isValidObjectId(audioId)) throw new HttpError(404, "Audio not found");
  const { attempt, test } = await loadAttempt(id, user);
  if (attempt.status !== "in_progress") throw new HttpError(409, "The test is already finished");
  // Audio hanya boleh diminta bila dipakai soal pada section aktif.
  const groupIds = (await Question.find({ _id: { $in: test.sections[attempt.sectionIdx].questionIds } }).select("groupId").lean())
    .map((q) => q.groupId).filter((g): g is NonNullable<typeof g> => !!g);
  const ok = await QuestionGroup.exists({ _id: { $in: groupIds }, audioId });
  if (!ok) throw new HttpError(403, "This audio is not part of this section");
  return attempt;
}

/** Mulai/lanjut putar. Mode tes: sekali putar. Refresh di tengah audio melanjutkan dari posisi terakhir. */
export async function POST(req: Request, { params }: { params: { id: string; audioId: string } }) {
  try {
    const attempt = await guard(params.id, params.audioId);
    const rec = attempt.audioPlays.find((p) => String(p.audioId) === params.audioId);
    // Mode latihan (practice): pemutar penuh, boleh diulang. Tes lain: sekali putar (MTS §11).
    if (rec?.done && attempt.kind !== "practice") throw new HttpError(403, "This audio has already been played and cannot be replayed");
    // ?prefetch=1: hanya tautan untuk mengunduh audio lebih dulu (diputar dari memori perangkat); belum dihitung diputar.
    if (new URL(req.url).searchParams.has("prefetch")) return NextResponse.json({ url: `/api/audio/${params.audioId}?token=${await signAudioToken(params.audioId, params.id)}`, startAtSec: rec?.lastPosSec ?? 0 });
    // Update atomik (bukan save dokumen penuh): tidak bentrok dengan autosave jawaban yang berjalan bersamaan.
    if (!rec) await Attempt.updateOne({ _id: attempt._id, "audioPlays.audioId": { $ne: params.audioId } }, { $push: { audioPlays: { audioId: params.audioId, playedAt: new Date(), lastPosSec: 0, done: false } } });
    const token = await signAudioToken(params.audioId, params.id);
    return NextResponse.json({
      url: `/api/audio/${params.audioId}?token=${token}`,
      startAtSec: rec?.lastPosSec ?? 0,
    });
  } catch (e) {
    return handleError(e);
  }
}

const progress = z.object({ posSec: z.number().min(0).max(3600), done: z.boolean().optional() });

/** Klien melaporkan posisi putar; `done` mengunci audio agar tidak bisa diputar lagi. */
export async function PATCH(req: Request, { params }: { params: { id: string; audioId: string } }) {
  try {
    const attempt = await guard(params.id, params.audioId);
    const b = progress.parse(await req.json());
    const rec = attempt.audioPlays.find((p) => String(p.audioId) === params.audioId);
    if (!rec) throw new HttpError(409, "Audio has not been started");
    // Pengaman: "selesai" hanya diterima bila waktu sejak mulai diputar ≥ 80% durasi audio (audio tidak bisa terkunci sebelum terdengar).
    let done = !!b.done;
    if (done) {
      const dur = (await Audio.findById(params.audioId).select("durationSec").lean())?.durationSec ?? 0;
      if (dur && (Date.now() - +rec.playedAt!) / 1000 < dur * 0.8) done = false;
    }
    if (!rec.done && attempt.kind !== "practice") {
      // Atomik: posisi hanya maju ($max), tanda selesai tidak bisa hilang karena bentrok dengan autosave jawaban.
      await Attempt.updateOne(
        { _id: attempt._id, audioPlays: { $elemMatch: { audioId: rec.audioId, done: { $ne: true } } } },
        { $max: { "audioPlays.$.lastPosSec": done ? b.posSec : Math.min(b.posSec, Math.max(0, (Date.now() - +rec.playedAt!) / 1000)) }, ...(done ? { $set: { "audioPlays.$.done": true } } : {}) },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

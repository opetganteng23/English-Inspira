import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { putScreen, isFocused, type ScreenState } from "@/lib/screen-store";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";
const STATES: ScreenState[] = ["shared", "stopped", "unsupported", "denied"];
/** Batas waktu yang dikembalikan karena share layar per section (detik). */
const SCREEN_CREDIT_CAP_SEC = 600;

/**
 * Live screen view: ruang tes mengirim gambar layar terbaru (JPEG kecil) atau status share.
 * Gambar hanya disimpan di memori (lib/screen-store), menimpa gambar sebelumnya; tidak ke database/disk.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Attempt not found");
    const state = new URL(req.url).searchParams.get("state") as ScreenState | "gate";
    if (state !== "gate" && !STATES.includes(state)) throw new HttpError(400, "Invalid state");
    await connectDB();
    const a = await Attempt.findOne({ _id: params.id, userId: user._id, status: "in_progress" }).select("testId sectionIdx screenGate timeCredits screenCredits").lean();
    if (!a) throw new HttpError(404, "Attempt not found");
    const t = await Test.findById(a.testId).select("screenWatch").lean();
    if (!t?.screenWatch) throw new HttpError(409, "Live screen view is off for this test");
    // Jeda layar penutup soal dicatat di server (bukan jam peserta): mulai saat "gate"/"stopped"/"denied", ditutup saat "shared".
    let credited = 0;
    const idx = a.sectionIdx ?? 0;
    if (state === "gate" || state === "stopped" || state === "denied") {
      if (!a.screenGate?.since) await Attempt.updateOne({ _id: a._id, status: "in_progress", "screenGate.since": { $exists: false } }, { $set: { screenGate: { since: new Date(), section: idx } } });
    } else if (state === "shared" && a.screenGate?.since) {
      const used = a.screenCredits?.[idx] ?? 0;
      // Hanya untuk section yang sama; jeda yang melewati pergantian section tidak dikembalikan ke section baru.
      const add = a.screenGate.section === idx ? Math.max(0, Math.min(Math.round((Date.now() - +a.screenGate.since) / 1000), SCREEN_CREDIT_CAP_SEC - used)) : 0;
      const tc = [...(a.timeCredits ?? [])], sc = [...(a.screenCredits ?? [])];
      while (tc.length <= idx) tc.push(0);
      while (sc.length <= idx) sc.push(0);
      tc[idx] += add; sc[idx] += add;
      const r = await Attempt.updateOne({ _id: a._id, status: "in_progress", "screenGate.since": a.screenGate.since }, { $set: add ? { timeCredits: tc, screenCredits: sc } : {}, $unset: { screenGate: 1 } });
      if (r.modifiedCount && add) credited = add;
    }
    if (state === "gate") return NextResponse.json({ ok: true });
    let img: Buffer | null = null;
    if (state === "shared") {
      const buf = Buffer.from(await req.arrayBuffer());
      if (buf.length > 1_500_000) throw new HttpError(413, "Image too large");
      if (buf.length) { if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new HttpError(415, "JPEG only"); img = buf; }
    }
    putScreen(params.id, { img, state, testId: String(a.testId), userId: String(user._id), institutionId: user.institutionId ? String(user.institutionId) : "" });
    return NextResponse.json({ ok: true, hd: isFocused(params.id), credited }); // hd: admin sedang memperbesar layar ini
  } catch (e) {
    return handleError(e);
  }
}

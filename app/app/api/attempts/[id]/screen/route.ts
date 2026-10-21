import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { putScreen, type ScreenState } from "@/lib/screen-store";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";
const STATES: ScreenState[] = ["shared", "stopped", "unsupported", "denied"];

/**
 * Live screen view: ruang tes mengirim gambar layar terbaru (JPEG kecil) atau status share.
 * Gambar hanya disimpan di memori (lib/screen-store), menimpa gambar sebelumnya; tidak ke database/disk.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Attempt not found");
    const state = new URL(req.url).searchParams.get("state") as ScreenState;
    if (!STATES.includes(state)) throw new HttpError(400, "Invalid state");
    await connectDB();
    const a = await Attempt.findOne({ _id: params.id, userId: user._id, status: "in_progress" }).select("testId").lean();
    if (!a) throw new HttpError(404, "Attempt not found");
    const t = await Test.findById(a.testId).select("screenWatch").lean();
    if (!t?.screenWatch) throw new HttpError(409, "Live screen view is off for this test");
    let img: Buffer | null = null;
    if (state === "shared") {
      const buf = Buffer.from(await req.arrayBuffer());
      if (buf.length > 300_000) throw new HttpError(413, "Image too large");
      if (buf.length) { if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new HttpError(415, "JPEG only"); img = buf; }
    }
    putScreen(params.id, { img, state, testId: String(a.testId), userId: String(user._id), institutionId: user.institutionId ? String(user.institutionId) : "" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

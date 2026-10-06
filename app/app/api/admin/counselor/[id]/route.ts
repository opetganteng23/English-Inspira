import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { CounselorThread } from "@/models/Counselor";
import { User } from "@/models/User";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Percakapan tidak ditemukan");
  await connectDB();
  const t = await CounselorThread.findById(id);
  if (!t) throw new HttpError(404, "Percakapan tidak ditemukan");
  return t;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const t = await find(params.id);
    const u = await User.findById(t.userId).select("name email targetScore").lean();
    await audit(admin._id, "counselor.view", params.id); // membaca percakapan peserta dicatat
    return NextResponse.json({
      id: String(t._id), user: { name: u?.name, email: u?.email, targetScore: u?.targetScore }, title: t.title, flagged: t.flagged, reviewed: t.reviewed, reviewNote: t.reviewNote ?? "",
      helpful: t.helpful ?? null, messages: t.messages.map((m) => ({ role: m.role, content: m.content, at: m.at, mock: m.mock })), actionPlan: t.actionPlan,
    });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({ reviewed: z.boolean().optional(), flagged: z.boolean().optional(), reviewNote: z.string().max(1000).optional() });
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const t = await find(params.id);
    t.set(patch.parse(await req.json()));
    await t.save();
    await audit(admin._id, "counselor.review", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

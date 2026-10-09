import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, scopeByInstitution } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { CounselorThread } from "@/models/Counselor";
import { User } from "@/models/User";

/** Thread hanya boleh dibuka bila pemiliknya peserta di institusi coach; selain itu 404. */
async function find(coach: Parameters<typeof scopeByInstitution>[0], id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Conversation not found");
  await connectDB();
  const t = await CounselorThread.findById(id);
  const owner = t ? await User.findOne(scopeByInstitution(coach, { _id: t.userId, role: "participant" } as never)).select("name email").lean() : null;
  if (!t || !owner) throw new HttpError(404, "Conversation not found");
  return { t, owner };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const coach = await requireRole(["coach"]);
    const { t, owner } = await find(coach, params.id);
    await audit(coach._id, "counselor.view", params.id); // membaca percakapan peserta dicatat
    return NextResponse.json({
      id: String(t._id), user: owner.name ?? owner.email, title: t.title, flagged: t.flagged, reviewed: t.reviewed, reviewNote: t.reviewNote ?? "", helpful: t.helpful ?? null,
      messages: t.messages.map((m) => ({ role: m.role, content: m.content, at: m.at, mock: m.mock })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({ reviewed: z.boolean().optional(), flagged: z.boolean().optional(), reviewNote: z.string().max(1000).optional() });
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const coach = await requireRole(["coach"]);
    const { t } = await find(coach, params.id);
    t.set(patch.parse(await req.json()));
    await t.save();
    await audit(coach._id, "counselor.review", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

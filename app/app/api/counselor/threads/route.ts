import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { counselorAccess } from "@/lib/counselor-access";
import { CounselorThread } from "@/models/Counselor";
import { Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";
const ROLES = ["participant", "admin"] as const;

export async function GET() {
  try {
    const user = await requireRole([...ROLES]);
    await connectDB();
    const threads = await CounselorThread.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(50).lean();
    return NextResponse.json({
      access: await counselorAccess(user._id),
      threads: threads.map((t) => ({
        id: String(t._id), title: t.title ?? "Percakapan", attemptId: t.attemptId ? String(t.attemptId) : null, updatedAt: t.updatedAt,
        last: t.messages[t.messages.length - 1]?.content?.slice(0, 80) ?? "", open: t.actionPlan.filter((p) => !p.done).length,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({ attemptId: z.string().optional() });

/** Buat percakapan baru; bila terkait hasil tes, tes itu menjadi dasar percakapan. Satu thread per attempt (dipakai ulang). */
export async function POST(req: Request) {
  try {
    const user = await requireRole([...ROLES]);
    const { attemptId } = schema.parse(await req.json().catch(() => ({})));
    await connectDB();
    let title = "Percakapan baru";
    if (attemptId) {
      if (!isValidObjectId(attemptId)) throw new HttpError(400, "Attempt tidak valid");
      const a = await Attempt.findOne({ _id: attemptId, userId: user._id, status: "submitted" }).select("kind").lean();
      if (!a) throw new HttpError(404, "Hasil tes tidak ditemukan");
      const existing = await CounselorThread.findOne({ userId: user._id, attemptId });
      if (existing) return NextResponse.json({ id: String(existing._id), reused: true });
      title = a.kind === "placement" ? "Hasil placement" : "Hasil tes";
    }
    const t = await CounselorThread.create({ userId: user._id, attemptId, title });
    return NextResponse.json({ id: String(t._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

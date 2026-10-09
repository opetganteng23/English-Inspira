import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { CounselorThread } from "@/models/Counselor";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Percakapan AI Counselor milik peserta di institusi coach, untuk ditinjau (MTS §17). filter: review (default) | flagged | all. */
export async function GET(req: Request) {
  try {
    const coach = await requireRole(["coach"]);
    await connectDB();
    const mine = await User.find({ institutionId: coach.institutionId, role: "participant" }).select("name email").lean();
    const filter = new URL(req.url).searchParams.get("filter") ?? "review";
    const q: Record<string, unknown> = { userId: { $in: mine.map((u) => u._id) }, ...(filter === "flagged" ? { flagged: true } : filter === "all" ? {} : { reviewed: false, $or: [{ flagged: true }, { helpful: false }] }) };
    const threads = await CounselorThread.find(q).sort({ updatedAt: -1 }).limit(100).lean();
    const nm = new Map(mine.map((u) => [String(u._id), u.name ?? u.email]));
    return NextResponse.json({
      threads: threads.map((t) => ({ id: String(t._id), user: nm.get(String(t.userId)) ?? "-", title: t.title ?? "", flagged: t.flagged, reviewed: t.reviewed, helpful: t.helpful ?? null, messages: t.messages.length, updatedAt: t.updatedAt, last: t.messages[t.messages.length - 1]?.content?.slice(0, 100) ?? "" })),
    });
  } catch (e) {
    return handleError(e);
  }
}

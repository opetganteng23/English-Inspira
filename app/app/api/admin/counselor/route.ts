import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { CounselorThread } from "@/models/Counselor";
import { User } from "@/models/User";
import { getParam } from "@/lib/config";
import { aiEnabled, AI_MODEL } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const filter = new URL(req.url).searchParams.get("filter") ?? "review";
    const q: Record<string, unknown> = filter === "flagged" ? { flagged: true } : filter === "all" ? {} : { reviewed: false, $or: [{ flagged: true }, { helpful: false }] };
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [threads, convo, helpfulYes, helpfulAll, plans, needReview, cfg] = await Promise.all([
      CounselorThread.find(q).sort({ updatedAt: -1 }).limit(100).lean(),
      CounselorThread.countDocuments({ updatedAt: { $gte: since } }),
      CounselorThread.countDocuments({ updatedAt: { $gte: since }, helpful: true }),
      CounselorThread.countDocuments({ updatedAt: { $gte: since }, helpful: { $in: [true, false] } }),
      CounselorThread.countDocuments({ updatedAt: { $gte: since }, "actionPlan.0": { $exists: true } }),
      CounselorThread.countDocuments({ reviewed: false, $or: [{ flagged: true }, { helpful: false }] }),
      getParam("counselor_quota"),
    ]);
    const users = new Map((await User.find({ _id: { $in: threads.map((t) => t.userId) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    return NextResponse.json({
      stats: { conversations30d: convo, helpfulPct: helpfulAll ? Math.round((helpfulYes / helpfulAll) * 100) : null, plans30d: plans, needReview },
      settings: { monthlyQuota: cfg }, ai: { enabled: aiEnabled(), model: aiEnabled() ? AI_MODEL() : null },
      threads: threads.map((t) => ({
        id: String(t._id), user: users.get(String(t.userId))?.name ?? users.get(String(t.userId))?.email ?? "-", title: t.title, flagged: t.flagged, reviewed: t.reviewed,
        helpful: t.helpful ?? null, messages: t.messages.length, updatedAt: t.updatedAt, last: t.messages[t.messages.length - 1]?.content?.slice(0, 100) ?? "",
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

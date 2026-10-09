import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { getLevels } from "@/lib/config";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Attempt } from "@/models/Test";
import { MailJob } from "@/models/Access";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import { CounselorThread } from "@/models/Counselor";
import { Analysis } from "@/models/Learning";

export const dynamic = "force-dynamic";

/** Dashboard admin v2.2: peserta, placement, sebaran level, aktivitas tes, dan hal yang perlu ditindak. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
    const since = new Date(Date.now() - days * 86_400_000), now = new Date();

    const [levels, insts, byStatus, byLevel, tests, placements, activeUsers, docsPending, pastUnscored, needReview, mailFailed, mailQueued, upcoming, expiring, aiAgg, aiFailed] = await Promise.all([
      getLevels(),
      Institution.countDocuments({ status: "active" }),
      User.aggregate([{ $match: { role: "participant" } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { role: "participant", currentLevelId: { $exists: true } } }, { $group: { _id: "$currentLevelId", n: { $sum: 1 } } }]),
      Attempt.aggregate([{ $match: { status: "submitted", finishedAt: { $gte: since } } }, { $group: { _id: "$kind", n: { $sum: 1 } } }]),
      Attempt.countDocuments({ kind: "placement", status: "submitted" }),
      User.countDocuments({ role: "participant", lastLoginAt: { $gte: since } }),
      ItpRegistration.countDocuments({ docStatus: "pending", status: { $ne: "cancelled" } }),
      ItpSession.find({ date: { $lt: now }, status: { $ne: "done" } }).select("_id").lean(),
      CounselorThread.countDocuments({ reviewed: false, $or: [{ flagged: true }, { helpful: false }] }),
      MailJob.countDocuments({ status: "failed" }),
      MailJob.countDocuments({ status: { $in: ["queued", "sending"] } }),
      ItpSession.find({ date: { $gte: now }, status: "open" }).sort({ date: 1 }).limit(5).lean(),
      Institution.find({ status: "active", contractEnd: { $gte: now, $lte: new Date(+now + 30 * 86_400_000) } }).select("name contractEnd").lean(),
      Analysis.aggregate([{ $match: { createdAt: { $gte: since }, status: "ready" } }, { $group: { _id: "$engine", n: { $sum: 1 }, tin: { $sum: "$tokensIn" }, tout: { $sum: "$tokensOut" } } }]),
      Analysis.countDocuments({ status: "failed" }),
    ]);
    const st = (k: string) => byStatus.find((x) => x._id === k)?.n ?? 0;
    const total = st("invited") + st("active") + st("disabled");
    const unscored = pastUnscored.length ? await ItpRegistration.countDocuments({ sessionId: { $in: pastUnscored.map((s) => s._id) }, status: { $ne: "cancelled" }, "score.total": { $exists: false } }) : 0;

    return NextResponse.json({
      days,
      kpi: { institutions: insts, participants: total, active: st("active"), invited: st("invited"), loggedInRecently: activeUsers, placementsDone: placements, placementPct: st("active") ? Math.round((placements / Math.max(1, st("active"))) * 100) : null },
      levels: levels.map((l) => ({ name: l.name, n: byLevel.find((x) => String(x._id) === String(l._id))?.n ?? 0 })),
      tests: tests.map((t) => ({ kind: t._id, n: t.n })),
      actions: [
        { label: "Invitations not accepted yet (status invited)", n: st("invited"), href: "/admin/participants?status=invited" },
        { label: "Emails failed to send", n: mailFailed, href: "/admin/settings" },
        { label: "Counselor conversations need review", n: needReview, href: "/admin/ai-counselor" },
        { label: "ITP documents awaiting verification", n: docsPending, href: "/admin/itp-schedule" },
        { label: "ITP scores not entered (past sessions)", n: unscored, href: "/admin/itp-schedule" },
        { label: "Institution contracts ending within 30 days", n: expiring.length, href: "/admin/institutions" },
        { label: "AI analyses failed (need retry)", n: aiFailed, href: "/admin" },
      ],
      mail: { queued: mailQueued, failed: mailFailed },
      ai: { claude: aiAgg.find((x) => x._id === "claude")?.n ?? 0, template: aiAgg.find((x) => x._id === "template")?.n ?? 0, tokensIn: aiAgg.reduce((a, x) => a + (x.tin ?? 0), 0), tokensOut: aiAgg.reduce((a, x) => a + (x.tout ?? 0), 0), failed: aiFailed },
      expiring: expiring.map((i) => ({ name: i.name, contractEnd: i.contractEnd })),
      upcoming: upcoming.map((s) => ({ id: String(s._id), title: s.title, date: s.date, place: s.place, registered: s.registered, quota: s.quota })),
    });
  } catch (e) {
    return handleError(e);
  }
}

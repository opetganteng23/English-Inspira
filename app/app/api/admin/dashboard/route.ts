import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Order, Entitlement } from "@/models/Commerce";
import { Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import { CounselorThread } from "@/models/Counselor";

export const dynamic = "force-dynamic";

async function revenue(from: Date, to: Date) {
  const r = await Order.aggregate([{ $match: { status: "paid", paidAt: { $gte: from, $lt: to } } }, { $group: { _id: null, sum: { $sum: "$total" }, n: { $sum: 1 } } }]);
  return { sum: r[0]?.sum ?? 0, n: r[0]?.n ?? 0 };
}

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
    const now = new Date(), since = new Date(+now - days * 86_400_000), prevSince = new Date(+since - days * 86_400_000);

    const [cur, prev, created, trialDone, trialUsers, signups, paidUsers, perProduct, itpActive, unscheduled, docsPending, pastUnscored, needReview, upcoming, stalePending] = await Promise.all([
      revenue(since, now), revenue(prevSince, since),
      Order.countDocuments({ createdAt: { $gte: since } }),
      Attempt.countDocuments({ kind: "trial", status: "submitted", finishedAt: { $gte: since } }),
      Attempt.distinct("userId", { kind: "trial", createdAt: { $gte: since } }),
      User.countDocuments({ role: "participant", createdAt: { $gte: since } }),
      Order.distinct("userId", { status: "paid", paidAt: { $gte: since } }),
      Order.aggregate([{ $match: { status: "paid", paidAt: { $gte: since } } }, { $unwind: "$items" }, { $group: { _id: "$items.name", revenue: { $sum: "$items.price" }, n: { $sum: 1 } } }, { $sort: { revenue: -1 } }]),
      ItpRegistration.countDocuments({ status: { $ne: "cancelled" } }),
      Entitlement.aggregate([{ $match: { revokedAt: { $exists: false } } }, { $unwind: "$grants" }, { $match: { "grants.kind": "itp", "grants.remaining": { $gt: 0 } } }, { $group: { _id: "$userId" } }, { $count: "n" }]),
      ItpRegistration.countDocuments({ docStatus: "pending", status: { $ne: "cancelled" } }),
      ItpSession.find({ date: { $lt: now }, status: { $ne: "done" } }).select("_id title").lean(),
      CounselorThread.countDocuments({ reviewed: false, $or: [{ flagged: true }, { helpful: false }] }),
      ItpSession.find({ date: { $gte: now }, status: "open" }).sort({ date: 1 }).limit(5).lean(),
      Order.countDocuments({ status: "pending", createdAt: { $lt: new Date(+now - 24 * 3600_000) } }),
    ]);
    const trialSet = new Set(trialUsers.map(String));
    const paidFromTrial = paidUsers.filter((u) => trialSet.has(String(u))).length;
    const unscoredCount = pastUnscored.length ? await ItpRegistration.countDocuments({ sessionId: { $in: pastUnscored.map((s) => s._id) }, status: { $ne: "cancelled" }, "score.total": { $exists: false } }) : 0;

    return NextResponse.json({
      days,
      kpi: {
        revenue: cur.sum, revenuePrev: prev.sum, revenueChangePct: prev.sum ? Math.round(((cur.sum - prev.sum) / prev.sum) * 100) : null,
        paidOrders: cur.n, createdOrders: created, trialCompleted: trialDone,
        conversionPct: trialSet.size ? Math.round((paidFromTrial / trialSet.size) * 1000) / 10 : null,
        itpParticipants: itpActive, itpUnscheduled: unscheduled[0]?.n ?? 0,
      },
      perProduct: perProduct.map((p) => ({ name: p._id, revenue: p.revenue, count: p.n })),
      funnel: [
        { label: "Akun baru", n: signups }, { label: "Mulai free trial", n: trialSet.size }, { label: "Selesai free trial", n: trialDone }, { label: "Membeli", n: paidUsers.length },
      ],
      actions: [
        { label: "Dokumen ITP menunggu verifikasi", n: docsPending, href: "/admin/jadwal-itp" },
        { label: "Skor ITP belum diinput (sesi lewat)", n: unscoredCount, href: "/admin/jadwal-itp" },
        { label: "Percakapan Konselor perlu ditinjau", n: needReview, href: "/admin/konselor-ai" },
        { label: "Pembayaran menunggu lebih dari 24 jam", n: stalePending, href: "/admin/transaksi" },
      ],
      upcoming: upcoming.map((s) => ({ id: String(s._id), title: s.title, date: s.date, place: s.place, registered: s.registered, quota: s.quota })),
    });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { PlanItem, TopicStat } from "@/models/Learning";

export const dynamic = "force-dynamic";

/** Study plan milik sendiri + peta topik (kuat/cukup/lemah/prioritas/belum cukup data). */
export async function GET() {
  try {
    const me = await requireRole(["participant"]);
    await connectDB();
    const [items, topics] = await Promise.all([
      PlanItem.find({ userId: me._id }).sort({ status: 1, priority: 1, dueAt: 1 }).limit(100).lean(),
      TopicStat.find({ userId: me._id }).sort({ score: 1 }).lean(),
    ]);
    return NextResponse.json({
      items: items.map((p) => ({ id: String(p._id), title: p.title, skill: p.skill, topic: p.topic, priority: p.priority, source: p.source, status: p.status, dueAt: p.dueAt ?? null })),
      topics: topics.map((t) => ({ skill: t.skill, topic: t.topic, score: Math.round(t.score), items: t.items, status: t.status })),
    });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { TOPIC_RE, parseTopic } from "@/lib/blocks";
import { updateTopicStats } from "@/lib/topic-stats";
import { refreshStudyPlan } from "@/lib/study-plan";
import { BlockEvent } from "@/models/Course";
import { Material } from "@/models/Material";
import { visibleTo } from "@/lib/material-authz";
import { TopicStat } from "@/models/Learning";

const limiter = new RateLimiterMemory({ points: 60, duration: 60 });
const dayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const body = z.object({
  materialId: z.string().regex(/^[0-9a-f]{24}$/), blockId: z.string().regex(/^[A-Za-z0-9]{1,24}$/), itemId: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
  topic: z.string().regex(TOPIC_RE), correct: z.boolean(),
});

/**
 * Hasil satu butir blok interaktif di materi. Topik harus benar-benar dideklarasikan oleh materi terbit (tidak bisa mengarang topik),
 * dicatat sekali per butir per hari, lalu memperbarui topic_stats dan study plan.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    try { await limiter.consume(String(me._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Terlalu sering"); throw e; }
    const b = body.parse(await req.json());
    await connectDB();
    const m = await Material.findOne({ _id: b.materialId, status: "published", ...visibleTo(me) }).select("contentHtml").lean();
    if (!m || !(m.contentHtml ?? "").includes(`data-topic="${b.topic}"`)) throw new HttpError(404, "Blok tidak ditemukan");
    const { skill, topic } = parseTopic(b.topic);
    const ins = await BlockEvent.updateOne(
      { userId: me._id, materialId: b.materialId, blockId: b.blockId, itemId: b.itemId, day: dayWib() },
      { $setOnInsert: { ...(me.institutionId ? { institutionId: me.institutionId } : {}), skill, topic, correct: b.correct } },
      { upsert: true }
    );
    const counted = ins.upsertedCount > 0;
    if (counted) {
      await updateTopicStats(me._id, me.institutionId ?? undefined, null, [{ skill, topic, correct: b.correct ? 1 : 0, total: 1, score: b.correct ? 100 : 0 }]);
      const all = await TopicStat.find({ userId: me._id }).lean();
      await refreshStudyPlan(me._id, me.institutionId ?? undefined, all.map((t) => ({ skill: t.skill, topic: t.topic, score: t.score, status: t.status })));
    }
    return NextResponse.json({ ok: true, counted });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

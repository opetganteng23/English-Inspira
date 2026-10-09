import type { Types } from "mongoose";
import { connectDB } from "./db";
import { getParam } from "./config";
import { PlanItem } from "@/models/Learning";
import type { TopicStatus } from "./topic-stats";
import { findRemedialUnit } from "./units";
import { User } from "@/models/User";

type T = { skill: string; topic: string; score: number; status: TopicStatus };

/** Pilih topik yang perlu masuk rencana: priority dulu (skor terendah lebih dulu), lalu weak. Hanya yang belum punya item aktif. */
export function planCandidates(topics: T[], activeKeys: Set<string>, slots: number) {
  const rank = (t: T) => (t.status === "priority" ? 0 : 1);
  return topics
    .filter((t) => (t.status === "priority" || t.status === "weak") && !activeKeys.has(`${t.skill}|${t.topic}`))
    .sort((a, b) => rank(a) - rank(b) || a.score - b.score)
    .slice(0, Math.max(0, slots));
}

/**
 * Perbarui study plan otomatis (MTS §15): item auto untuk topik yang kini membaik ditandai `resolved`;
 * topik lemah baru ditambahkan sampai batas `plan_max_active` (item coach ikut dihitung tetapi tidak pernah ditimpa).
 */
export async function refreshStudyPlan(userId: Types.ObjectId | string, institutionId: Types.ObjectId | string | undefined, topics: T[], analysisId?: Types.ObjectId | string) {
  await connectDB();
  const [max, days] = await Promise.all([getParam("plan_max_active"), getParam("plan_deadline_days")]);
  const status = new Map(topics.map((t) => [`${t.skill}|${t.topic}`, t.status]));

  const active = await PlanItem.find({ userId, status: { $in: ["active", "late"] } });
  let resolved = 0;
  for (const it of active) {
    const st = status.get(`${it.skill}|${it.topic}`);
    if (it.source === "auto" && st && (st === "ok" || st === "strong")) {
      it.status = "resolved"; it.doneAt = new Date(); await it.save(); resolved++;
    }
  }
  const stillActive = active.filter((i) => i.status === "active" || i.status === "late");
  const created = planCandidates(topics, new Set(stillActive.map((i) => `${i.skill}|${i.topic}`)), max - stillActive.length);
  const lvl = created.length ? (await User.findById(userId).select("currentLevelId").lean())?.currentLevelId : null;
  for (const t of created) {
    const high = t.status === "priority";
    const unitId = await findRemedialUnit(lvl, t.skill, t.topic);
    await PlanItem.create({
      userId, ...(institutionId ? { institutionId } : {}), skill: t.skill, topic: t.topic, priority: high ? "high" : "medium", source: "auto",
      title: `Perkuat topik ${t.topic} (${t.skill})`, dueAt: new Date(Date.now() + (high ? days.high : days.medium) * 86_400_000), analysisId, ...(unitId ? { unitId } : {}),
    });
  }
  return { created: created.length, resolved };
}

/** Item yang lewat deadline ditandai `late` (masih terhitung aktif dan bisa dikerjakan). Dipanggil job harian. */
export async function markLatePlanItems() {
  await connectDB();
  const r = await PlanItem.updateMany({ status: "active", dueAt: { $lt: new Date() } }, { status: "late" });
  return r.modifiedCount;
}

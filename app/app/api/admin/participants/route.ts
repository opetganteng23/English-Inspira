import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { getLevels } from "@/lib/config";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Attempt } from "@/models/Test";
import { CoachingQuota } from "@/models/Config";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Daftar peserta lintas institusi untuk admin: level, skor estimasi, kuota coaching, status undangan. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = { role: "participant" };
    const q = sp.get("q")?.trim();
    if (q) { const rx = new RegExp(esc(q), "i"); filter.$or = [{ name: rx }, { email: rx }]; }
    if (sp.get("institution")) filter.institutionId = sp.get("institution");
    if (sp.get("status")) filter.status = sp.get("status");
    if (sp.get("level")) filter.currentLevelId = sp.get("level");
    const page = Math.max(1, Number(sp.get("page")) || 1), size = 25;

    const [users, total, levels, insts] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
      User.countDocuments(filter), getLevels(), Institution.find().select("name").lean(),
    ]);
    const ids = users.map((u) => u._id);
    const [quotas, lastAt] = await Promise.all([
      CoachingQuota.find({ userId: { $in: ids }, active: true }).lean(),
      Attempt.aggregate([{ $match: { userId: { $in: ids }, status: "submitted" } }, { $group: { _id: "$userId", at: { $max: "$finishedAt" }, n: { $sum: 1 } } }]),
    ]);
    const lv = new Map(levels.map((l) => [String(l._id), l.name])), inst = new Map(insts.map((i) => [String(i._id), i.name]));
    return NextResponse.json({
      total, page, pages: Math.max(1, Math.ceil(total / size)),
      levels: levels.map((l) => ({ id: String(l._id), name: l.name })),
      participants: users.map((u) => {
        const qt = quotas.find((x) => String(x.userId) === String(u._id)), la = lastAt.find((x) => String(x._id) === String(u._id));
        return { id: String(u._id), name: u.name ?? null, email: u.email, status: u.status, institution: u.institutionId ? inst.get(String(u.institutionId)) ?? "-" : null,
          level: u.currentLevelId ? lv.get(String(u.currentLevelId)) ?? "-" : null, scoreEst: u.currentScoreEst ?? null, placementDone: !!u.placementAttemptId,
          quota: qt ? { used: qt.used, total: qt.total } : null, tests: la?.n ?? 0, lastAt: la?.at ?? null, lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

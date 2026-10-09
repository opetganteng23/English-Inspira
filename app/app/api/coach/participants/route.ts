import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, scopeByInstitution } from "@/lib/rbac";
import { getLevels } from "@/lib/config";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { CoachingQuota } from "@/models/Config";

export const dynamic = "force-dynamic";

/**
 * Peserta institusi coach (filter institusi di level query). Coach hanya melihat institusinya sendiri.
 * Profil lengkap, laporan pra-sesi, dan catatan: Fase 6.
 */
export async function GET(req: Request) {
  try {
    const coach = await requireRole(["coach"]);
    await connectDB();
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const extra = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
    const users = await User.find(scopeByInstitution(coach, { role: "participant", status: { $ne: "disabled" }, ...extra } as never)).sort({ name: 1 }).limit(500).lean();
    const ids = users.map((u) => u._id);
    const [levels, quotas, last] = await Promise.all([
      getLevels(), CoachingQuota.find({ userId: { $in: ids }, active: true }).lean(),
      Attempt.aggregate([{ $match: { userId: { $in: ids }, status: "submitted" } }, { $group: { _id: "$userId", at: { $max: "$finishedAt" } } }]),
    ]);
    const lv = new Map(levels.map((l) => [String(l._id), l.name]));
    return NextResponse.json({
      participants: users.map((u) => {
        const qt = quotas.find((x) => String(x.userId) === String(u._id));
        return { id: String(u._id), name: u.name ?? null, email: u.email, status: u.status, level: u.currentLevelId ? lv.get(String(u.currentLevelId)) ?? null : null, scoreEst: u.currentScoreEst ?? null,
          quota: qt ? { used: qt.used, total: qt.total } : null, lastAt: last.find((x) => String(x._id) === String(u._id))?.at ?? null };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

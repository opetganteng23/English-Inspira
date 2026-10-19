import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { getLevels } from "@/lib/config";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Attempt, Test as TestModel } from "@/models/Test";
import { CoachingQuota } from "@/models/Config";

import { TestSession, TestSeat } from "@/models/Schedule";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Daftar peserta lintas institusi untuk admin: level, skor estimasi, kuota coaching, status undangan. */
export async function GET(req: Request) {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = { role: "participant", deletedAt: { $exists: false } };
    const q = sp.get("q")?.trim();
    if (q) { const rx = new RegExp(esc(q), "i"); filter.$or = [{ name: rx }, { email: rx }]; }
    const instQ = sp.get("institution");
    if (instQ === "none") filter.institutionId = { $in: [null] };
    else if (instQ && /^[0-9a-f]{24}$/.test(instQ)) filter.institutionId = instQ;
    if (sp.get("status")) filter.status = sp.get("status");
    if (sp.get("level")) filter.currentLevelId = sp.get("level");
    // Placement: "done" = sudah submit placement (termasuk yang hasilnya masih ditahan), "none" = belum.
    const placement = sp.get("placement");
    if (placement === "done" || placement === "none") {
      const did = await Attempt.distinct("userId", { kind: "placement", status: "submitted" });
      const cond = placement === "done" ? { $or: [{ placementAttemptId: { $exists: true, $ne: null } }, { _id: { $in: did } }] } : { placementAttemptId: { $in: [null] }, _id: { $nin: did } };
      filter.$and = [...((filter.$and as unknown[]) ?? []), cond];
    }
    const session = sp.get("session");
    if (session && /^[0-9a-f]{24}$/.test(session)) filter.$and = [...((filter.$and as unknown[]) ?? []), { _id: { $in: await TestSeat.distinct("userId", { sessionId: session }) } }];
    const page = Math.max(1, Number(sp.get("page")) || 1), size = [25, 50, 100, 200].includes(Number(sp.get("size"))) ? Number(sp.get("size")) : 25;
    const SORTS: Record<string, Record<string, 1 | -1>> = { newest: { createdAt: -1 }, name: { name: 1, email: 1 }, name_desc: { name: -1, email: -1 }, score: { currentScoreEst: -1, name: 1 }, score_asc: { currentScoreEst: 1, name: 1 }, status: { status: 1, name: 1 }, login: { lastLoginAt: -1 } };
    const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.newest;

    const [users, total, levels, insts] = await Promise.all([
      User.find(filter).sort({ ...sort, _id: 1 }).skip((page - 1) * size).limit(size).lean(),
      User.countDocuments(filter), getLevels(), Institution.find().select("name").lean(),
    ]);
    const ids = users.map((u) => u._id);
    // Hasil placement yang belum dirilis ke peserta (jeda rilis atau ditahan institusi): admin tetap melihat skornya.
    const pending = new Map((await Attempt.find({ userId: { $in: ids }, kind: "placement", status: "submitted", releasedAt: { $exists: false }, releaseAt: { $exists: true } }).sort({ finishedAt: -1 }).select("userId scoreEst releaseAt heldByOrg").lean()).reverse().map((a) => [String(a.userId), a]));
    const [quotas, lastAt] = await Promise.all([
      CoachingQuota.find({ userId: { $in: ids }, active: true }).lean(),
      Attempt.aggregate([{ $match: { userId: { $in: ids }, status: "submitted" } }, { $group: { _id: "$userId", at: { $max: "$finishedAt" }, n: { $sum: 1 } } }]),
    ]);
    const lv = new Map(levels.map((l) => [String(l._id), l.name])), inst = new Map(insts.map((i) => [String(i._id), i.name]));
    return NextResponse.json({
      total, page, pages: Math.max(1, Math.ceil(total / size)),
      levels: levels.map((l) => ({ id: String(l._id), name: l.name })),
      sessions: await scheduleOptions(),
      participants: users.map((u) => {
        const qt = quotas.find((x) => String(x.userId) === String(u._id)), la = lastAt.find((x) => String(x._id) === String(u._id));
        return { id: String(u._id), name: u.name ?? null, email: u.email, status: u.status, institution: u.institutionId ? inst.get(String(u.institutionId)) ?? "-" : null,
          level: u.currentLevelId ? lv.get(String(u.currentLevelId)) ?? "-" : null, scoreEst: u.currentScoreEst ?? null, placementDone: !!u.placementAttemptId || pending.has(String(u._id)),
          pending: pending.has(String(u._id)) ? { score: pending.get(String(u._id))!.scoreEst ?? null, level: (() => { const sc = pending.get(String(u._id))!.scoreEst; const l = typeof sc === "number" ? levels.find((x) => sc >= x.scoreMin && sc <= x.scoreMax) : null; return l?.name ?? null; })(), held: !!pending.get(String(u._id))!.heldByOrg, releaseAt: pending.get(String(u._id))!.releaseAt } : null, qaTester: !!u.qaTester,
          quota: qt ? { used: qt.used, total: qt.total } : null, tests: la?.n ?? 0, lastAt: la?.at ?? null, lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Pilihan filter jadwal: sesi tes terjadwal yang aktif (mis. Placement 20-27 Okt). */
async function scheduleOptions() {
  const tests = await TestModel.find({ scheduled: true, active: true }).select("name").lean();
  if (!tests.length) return [];
  const name = new Map(tests.map((t) => [String(t._id), t.name]));
  const ss = await TestSession.find({ testId: { $in: tests.map((t) => t._id) } }).sort({ opensAt: 1 }).select("testId label").lean();
  return ss.map((x) => ({ id: String(x._id), label: x.label, test: name.get(String(x.testId)) ?? "" }));
}

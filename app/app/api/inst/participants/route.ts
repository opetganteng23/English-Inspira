import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext, memberResults } from "@/lib/inst";
import { ageOf, birthRange, AGE_GROUPS } from "@/lib/age";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

const SORTS: Record<string, Record<string, 1 | -1>> = { name: { name: 1 }, branch: { branch: 1, name: 1 }, age: { birthDate: -1, name: 1 }, age_desc: { birthDate: 1, name: 1 }, score: { currentScoreEst: -1, name: 1 }, score_asc: { currentScoreEst: 1, name: 1 } };

export async function GET(req: Request) {
  try {
    const { scoped, full } = await instContext(req);
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim();
    const size = 50, page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
    const extra: Record<string, unknown> = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
    if (sp.get("branch")) extra.branch = sp.get("branch");
    const br = sp.get("age") ? birthRange(sp.get("age")!) : null;
    if (br) extra.birthDate = br;
    const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.name;
    // Bertahap 50 per halaman (institusi bisa punya ribuan peserta).
    const [members, total, branches] = await Promise.all([
      User.find(scoped(extra)).sort({ ...sort, _id: 1 }).skip((page - 1) * size).limit(size).select("name email targetScore createdAt status currentScoreEst branch birthDate").lean(),
      User.countDocuments(scoped(extra)),
      User.distinct("branch", scoped({ branch: { $nin: [null, ""] } })),
    ]);
    const results = await memberResults(members.map((m) => m._id), full);
    return NextResponse.json({
      total, page, pages: Math.max(1, Math.ceil(total / size)),
      branches: branches.sort(), ageGroups: AGE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
      participants: members.map((m) => {
        const l = results.get(String(m._id)) ?? [];
        const last = l[l.length - 1];
        return { id: String(m._id), status: m.status, name: m.name ?? null, email: m.email, target: m.targetScore ?? null, tests: l.length, firstScore: l[0]?.scoreEst ?? null, lastScore: last?.scoreEst ?? null, lastAt: last?.finishedAt ?? null, joinedAt: m.createdAt, branch: m.branch ?? null, age: ageOf(m.birthDate) };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

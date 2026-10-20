import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext, memberResults } from "@/lib/inst";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { scoped, full } = await instContext(req);
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim();
    const size = 50, page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
    const extra = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
    // Bertahap 50 per halaman (institusi bisa punya ribuan peserta).
    const [members, total] = await Promise.all([
      User.find(scoped(extra)).sort({ name: 1, _id: 1 }).skip((page - 1) * size).limit(size).select("name email targetScore createdAt status currentScoreEst").lean(),
      User.countDocuments(scoped(extra)),
    ]);
    const results = await memberResults(members.map((m) => m._id), full);
    return NextResponse.json({
      total, page, pages: Math.max(1, Math.ceil(total / size)),
      participants: members.map((m) => {
        const l = results.get(String(m._id)) ?? [];
        const last = l[l.length - 1];
        return { id: String(m._id), status: m.status, name: m.name ?? null, email: m.email, target: m.targetScore ?? null, tests: l.length, firstScore: l[0]?.scoreEst ?? null, lastScore: last?.scoreEst ?? null, lastAt: last?.finishedAt ?? null, joinedAt: m.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

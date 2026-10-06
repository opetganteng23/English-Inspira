import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext, memberResults } from "@/lib/inst";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { scoped } = await instContext(req);
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const extra = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
    const members = await User.find(scoped(extra)).sort({ name: 1 }).limit(1000).select("name email targetScore createdAt").lean();
    const results = await memberResults(members.map((m) => m._id));
    return NextResponse.json({
      participants: members.map((m) => {
        const l = results.get(String(m._id)) ?? [];
        const last = l[l.length - 1];
        return { id: String(m._id), name: m.name ?? null, email: m.email, target: m.targetScore ?? null, tests: l.length, firstScore: l[0]?.scoreEst ?? null, lastScore: last?.scoreEst ?? null, lastAt: last?.finishedAt ?? null, joinedAt: m.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

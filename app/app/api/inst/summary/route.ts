import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext, memberResults, activeCounselors } from "@/lib/inst";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { inst, scoped } = await instContext(req);
    const members = await User.find(scoped()).select("name email targetScore createdAt").lean();
    const ids = members.map((m) => m._id);
    const [results, active] = await Promise.all([memberResults(ids), activeCounselors(ids)]);

    const latest: number[] = [], first: number[] = [];
    let reached = 0, withScore = 0;
    const dist = { "<450": 0, "450–499": 0, "500–549": 0, "≥550": 0 };
    const weak = new Map<string, number>();
    const attention: { id: string; name: string; reason: string; score: number | null }[] = [];
    const now = Date.now();

    for (const m of members) {
      const list = results.get(String(m._id)) ?? [];
      const last = list[list.length - 1], firstA = list[0];
      if (last?.scoreEst) {
        withScore++; latest.push(last.scoreEst); if (firstA?.scoreEst) first.push(firstA.scoreEst);
        if (last.scoreEst >= (m.targetScore ?? 500)) reached++;
        const s = last.scoreEst;
        dist[s < 450 ? "<450" : s < 500 ? "450–499" : s < 550 ? "500–549" : "≥550"]++;
        for (const w of ((last.aiAnalysis as { weaknesses?: { title: string }[] } | undefined)?.weaknesses ?? [])) weak.set(w.title, (weak.get(w.title) ?? 0) + 1);
      }
      const name = m.name ?? m.email;
      if (!list.length) attention.push({ id: String(m._id), name, reason: "Belum mengerjakan tes", score: null });
      else if (now - +(last.finishedAt ?? 0) > 14 * 86_400_000) attention.push({ id: String(m._id), name, reason: "Tidak ada aktivitas 14 hari", score: last.scoreEst ?? null });
      else if (list.length > 1 && (last.scoreEst ?? 0) < (firstA.scoreEst ?? 0)) attention.push({ id: String(m._id), name, reason: "Skor turun dari tes pertama", score: last.scoreEst ?? null });
    }
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    const avgLatest = avg(latest), avgFirst = avg(first);
    return NextResponse.json({
      institution: { name: inst.name, batch: inst.batch ?? null, contractEnd: inst.contractEnd ?? null, seats: inst.seats },
      registered: members.length, seats: inst.seats, seatsLeft: Math.max(0, inst.seats - members.length),
      activeCounseling: active.size, inactiveCounseling: members.length - active.size,
      avgEstimate: avgLatest, avgDelta: avgLatest != null && avgFirst != null ? avgLatest - avgFirst : null,
      reachedPct: withScore ? Math.round((reached / withScore) * 100) : null, reached, withScore,
      distribution: Object.entries(dist).map(([label, n]) => ({ label, n })),
      commonWeaknesses: Array.from(weak.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([title, n]) => ({ title, n })),
      attention: attention.slice(0, 20),
    });
  } catch (e) {
    return handleError(e);
  }
}

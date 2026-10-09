"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { HBars, Stat, Loading, ErrorNote } from "@/components/Charts";

type S = {
  institution: { name: string; code: string; batch: string | null; contractEnd: string | null; seats: number };
  registered: number; seats: number; seatsLeft: number; active: number; invited: number; placementDone: number; placementPct: number | null;
  levels: { label: string; n: number }[]; avgEstimate: number | null; avgDelta: number | null; reachedPct: number | null; reached: number; withScore: number;
  coaching: { sessionsMarked: number; presentPct: number | null; absent: number; quotaUsedPct: number | null };
  planLatePct: number | null; planLate: number; commonWeaknesses: { title: string; n: number }[];
  attention: { id: string; name: string; reason: string; score: number | null }[];
};

export default function InstHome() {
  const { url, ready } = useInstQuery();
  const { data: s, loading, error } = useApi<S>(url("/api/inst/summary"));
  if (!ready || loading) return <Loading />;
  if (!s) return <ErrorNote text={error || "Choose an institution from the admin menu."} />;
  const withQ = (p: string) => url(p) ?? p;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-wider text-brand">{s.institution.batch ?? "INSTITUTION PORTAL"}</p><h1 className="page-title">{s.institution.name}</h1><p className="text-sm text-ink-soft">Group summary (aggregate). Individual analyses and coach notes are not shown in this portal.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><a className="btn-outline" href={url("/api/inst/report.xlsx") ?? "#"}>Download report (Excel)</a><Link className="btn-solid" href={withQ("/institution/participants")}>Add participants</Link></div>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">Institution code for self-registration: <b className="font-display text-lg tracking-wider text-navy">{s.institution.code}</b></p>
        <p className="text-sm text-ink-soft">Participants create an account at <b>/register</b> with this code · {s.seatsLeft} seats left</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="PARTICIPANTS" value={<>{s.registered}<span className="text-lg text-ink-soft"> / {s.seats}</span></>} sub={`${s.active} active · ${s.invited} awaiting activation`} />
        <Stat label="PLACEMENT COMPLETED" value={s.placementPct != null ? `${s.placementPct}%` : "-"} sub={`${s.placementDone} of ${s.registered} participants`} />
        <Stat label="AVERAGE ESTIMATE" value={s.avgEstimate ?? "-"} sub={s.avgDelta != null ? `${s.avgDelta >= 0 ? "+" : ""}${s.avgDelta} since the first test` : "No comparison yet"} tone={s.avgDelta != null && s.avgDelta >= 0 ? "ok" : undefined} />
        <Stat label="REACHED TARGET" value={s.reachedPct != null ? `${s.reachedPct}%` : "-"} sub={`${s.reached} of ${s.withScore} participants with scores`} />
        <Stat label="COACHING ATTENDANCE" value={s.coaching.presentPct != null ? `${s.coaching.presentPct}%` : "-"} sub={`${s.coaching.sessionsMarked} sessions recorded · ${s.coaching.absent} absent`} />
        <Stat label="COACHING QUOTA USED" value={s.coaching.quotaUsedPct != null ? `${s.coaching.quotaUsedPct}%` : "-"} />
        <Stat label="OVERDUE PLANS" value={s.planLate} sub={s.planLatePct != null ? `${s.planLatePct}% of active participants` : undefined} tone={s.planLate ? "warn" : undefined} />
        <Stat label="CONTRACT ENDS" value={s.institution.contractEnd ? new Date(s.institution.contractEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Level distribution</h2><div className="mt-4"><HBars rows={s.levels.map((d) => ({ label: d.label, value: d.n, sub: "participants" }))} /></div></section>
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Most common weak topics</h2><p className="text-sm text-ink-soft">Material for in-person classes or internal training. Group aggregates only.</p><div className="mt-4"><HBars color="#F08A1C" rows={s.commonWeaknesses.map((w) => ({ label: w.title, value: w.n, sub: "participants" }))} /></div></section>
      </div>

      <section className="card"><div className="flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Participants who need attention</h2><Link href={withQ("/institution/participants")} className="text-sm font-semibold text-brand">See all participants</Link></div>
        {s.attention.length ? <div className="table-wrap mt-3 !border-0"><table><thead><tr><th>Participant</th><th>Reason</th><th>Score</th></tr></thead><tbody>{s.attention.map((a) => <tr key={a.id}><td className="font-semibold text-navy">{a.name}</td><td>{a.reason}</td><td>{a.score ?? "-"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-ink-soft">No participants need attention.</p>}</section>
    </div>
  );
}

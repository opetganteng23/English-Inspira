"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote, HBars } from "@/components/Charts";

type R = {
  profile: { id: string; name: string | null; email: string; level: string | null; scoreEst: number | null; nextLevel: { name: string; scoreMin: number } | null; targetScore: number | null; placementDone: boolean; placementRetakeAllowed: boolean };
  quota: { used: number; total: number } | null;
  attendance: { present: number; absent: number; excused: number; upcoming: number };
  topics: { skill: string; topic: string; score: number; items: number; status: string }[];
  stuck: string[];
  plan: { id: string; title: string; priority: string; source: string; status: string; dueAt: string | null }[];
  attempts: { id: string; kind: string; scoreEst: number; finishedAt: string }[];
  notes: { private: string; shared: string; recommendLevelUp: boolean; at: string }[];
};
const STATUS: Record<string, string> = { strong: "Strong", ok: "Cukup", weak: "Weak", priority: "Priority", insufficient: "Not enough data" };

export default function PesertaCoach({ params }: { params: { id: string } }) {
  const { data: r, loading, error, reload } = useApi<R>(`/api/coach/participants/${params.id}`);
  const [plan, setPlan] = useState({ title: "", dueInDays: 14 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (body: object, ok: string) => { setMsg(null); try { await api(`/api/coach/participants/${params.id}`, { json: body }); setMsg({ ok: true, text: ok }); reload(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } };

  if (loading && !r) return <Loading />;
  if (!r) return <div className="card max-w-lg"><ErrorNote text={error} /><Link href="/coach" className="mt-3 block text-sm font-semibold text-brand">My participants</Link></div>;
  const p = r.profile;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/coach" className="text-sm font-semibold text-brand">My participants</Link>
      <div><h1 className="page-title">{p.name ?? p.email}</h1><p className="text-sm text-ink-soft">{p.email}</p></div>
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">LEVEL</p><p className="font-display text-2xl font-extrabold text-navy">{p.level ?? "-"}</p><p className="text-xs text-ink-soft">{p.nextLevel ? `Berikut: ${p.nextLevel.name} (≥ ${p.nextLevel.scoreMin})` : ""}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">ESTIMATED SCORE</p><p className="font-display text-2xl font-extrabold text-navy">{p.scoreEst ?? "-"}</p><p className="text-xs text-ink-soft">{p.targetScore ? `Target ${p.targetScore}` : ""}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">QUOTA</p><p className="font-display text-2xl font-extrabold text-navy">{r.quota ? `${r.quota.total - r.quota.used} / ${r.quota.total}` : "-"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">ATTENDANCE</p><p className="text-sm text-navy">Present {r.attendance.present} · Absent {r.attendance.absent} · Excused {r.attendance.excused}</p><p className="text-xs text-ink-soft">{r.attendance.upcoming} upcoming sessions</p></div>
      </div>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Topics (weakest first)</h2>
        {r.topics.length ? <div className="mt-3"><HBars max={100} unit="%" rows={r.topics.slice(0, 10).map((t) => ({ label: `${t.topic} · ${STATUS[t.status] ?? t.status}`, value: t.score, sub: `${t.items} butir` }))} /></div> : <p className="mt-2 text-sm text-ink-soft">No topic data yet.</p>}
        {r.stuck.length > 0 && <p className="mt-3 rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">Stuck on: {r.stuck.join(", ")}</p>}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Study plan</h2>
        {r.plan.length ? <ul className="mt-2 divide-y divide-line text-sm">{r.plan.map((i) => <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b className="text-navy">{i.title}</b> <span className="text-xs text-ink-soft">{i.source === "coach" ? "· from coach" : "· otomatis"}{i.dueAt ? ` · target ${tgl(i.dueAt)}` : ""}</span></span><span className={i.status === "active" ? "badge-warn" : i.status === "done" || i.status === "resolved" ? "badge-ok" : "badge-muted"}>{i.status}</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-soft">No items yet.</p>}
        <div className="mt-3 grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[1fr_110px_auto]">
          <input aria-label="Plan item" className="field" placeholder="Add a plan item from the coach" value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
          <input aria-label="Days" className="field" type="number" min={1} max={90} value={plan.dueInDays} onChange={(e) => setPlan({ ...plan, dueInDays: Number(e.target.value) })} />
          <button className="btn-outline" disabled={plan.title.trim().length < 3} onClick={() => run({ action: "add_plan", ...plan }, "Item added.").then(() => setPlan({ title: "", dueInDays: 14 }))}>Add</button>
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Test history</h2>
        {r.attempts.length ? <ul className="mt-2 divide-y divide-line text-sm">{r.attempts.map((a) => <li key={a.id} className="flex justify-between gap-2 py-2"><span>{a.kind} · {tgl(a.finishedAt)}</span><b>{a.scoreEst}</b></li>)}</ul> : <p className="mt-2 text-sm text-ink-soft">None yet.</p>}
        {p.placementDone && !p.placementRetakeAllowed && <button className="btn-outline mt-3" onClick={() => { const reason = prompt("Reason for allowing a placement retake:"); if (reason) run({ action: "allow_placement_retake", reason }, "Placement may be retaken once."); }}>Allow placement retake</button>}
        {p.placementRetakeAllowed && <p className="mt-3 text-sm text-ink-soft">Placement retake already allowed.</p>}
      </section>

      {r.notes.length > 0 && <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Previous session notes (yours)</h2><ul className="mt-2 divide-y divide-line text-sm">{r.notes.map((n, i) => <li key={i} className="py-2"><span className="text-xs text-ink-soft">{tgl(n.at)}{n.recommendLevelUp ? " · level-up recommended" : ""}</span><br />{n.private || n.shared}</li>)}</ul></section>}
    </div>
  );
}

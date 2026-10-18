"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Person = { name: string; email: string; status: string; special: boolean };
type G = { id: string; name: string; kind: string; sessions: { id: string; label: string; opensAt: string; closesAt: string; people: Person[] }[] };
type S = { id: string; title: string; date: string; place: string; participants: { name: string; status: string; docStatus: string; total: number | null }[] };
const ST: Record<string, string> = { submitted: "Awaiting verification", confirmed: "Confirmed", done: "Done" };
const BADGE: Record<string, string> = { Finished: "badge-ok", "In progress": "badge bg-brand-tint text-brand", Missed: "badge-bad", "Not started (open now)": "badge-warn" };
const KIND: Record<string, string> = { placement: "Placement test", sim: "Simulation", final: "Final test" };
const wib = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default function InstJadwal() {
  const { url, ready } = useInstQuery();
  const { data, loading, error } = useApi<{ groups: G[]; sessions: S[] }>(url("/api/inst/schedule"));
  const [q, setQ] = useState("");
  if (!ready || loading) return <Loading />;
  const groups = data?.groups ?? [], official = data?.sessions ?? [];
  const match = (p: Person) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase());
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Group test schedule</h1><p className="text-sm text-ink-soft">Your participants&apos; scheduled test sessions and whether they have taken the test. Scores are not shown here. Times are in WIB.</p></div>
      <ErrorNote text={error} />
      {groups.length === 0 && official.length === 0 && <Empty>No scheduled tests for your participants yet.</Empty>}
      {groups.length > 0 && <input className="field max-w-md" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search participants" />}

      {groups.map((g) => {
        const all = g.sessions.flatMap((s) => s.people);
        const count = (st: string) => all.filter((p) => p.status === st).length;
        return (
          <section key={g.id} className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-brand">{(KIND[g.kind] ?? "Test").toUpperCase()}</p>
              <h2 className="font-display text-xl font-extrabold text-navy">{g.name}</h2>
              <p className="text-sm text-ink-soft">{all.length} participants · {count("Finished")} finished · {count("In progress")} in progress · {all.filter((p) => p.status.startsWith("Not started")).length} not started · {count("Missed")} missed</p>
            </div>
            <div className="table-wrap card !p-0"><table><thead><tr><th>Session</th><th>Window</th><th>Participants</th><th>Finished</th><th>In progress</th><th>Not started</th><th>Missed</th></tr></thead>
              <tbody>{g.sessions.map((s) => <tr key={s.id}><td className="font-semibold text-navy">{s.label}</td><td>{wib(s.opensAt)} to {wib(s.closesAt)}</td><td>{s.people.length}</td><td>{s.people.filter((p) => p.status === "Finished").length}</td><td>{s.people.filter((p) => p.status === "In progress").length}</td><td>{s.people.filter((p) => p.status.startsWith("Not started")).length}</td><td>{s.people.filter((p) => p.status === "Missed").length}</td></tr>)}</tbody></table></div>
            {g.sessions.map((s) => {
              const people = s.people.filter(match);
              if (q && !people.length) return null;
              return (
                <details key={s.id} className="card" open={!!q}>
                  <summary className="cursor-pointer font-semibold text-navy">{s.label} · {s.people.length} participants</summary>
                  <div className="table-wrap mt-3"><table><thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                    <tbody>{people.map((p) => <tr key={p.email}><td className="font-semibold text-navy">{p.name}</td><td>{p.email}</td><td><span className={BADGE[p.status] ?? "badge-muted"}>{p.status}</span>{p.special && <span className="ml-1 text-xs text-ink-soft">special time</span>}</td></tr>)}</tbody></table></div>
                </details>
              );
            })}
          </section>
        );
      })}

      {official.length > 0 && <h2 className="mt-4 font-display text-xl font-extrabold text-navy">Official EPTA test</h2>}
      {official.map((s) => (
        <section key={s.id} className="card">
          <h3 className="font-display text-lg font-extrabold text-navy">{s.title}</h3>
          <p className="text-sm text-ink-soft">{tgl(s.date, true)} · {s.place} · {s.participants.length} participants</p>
          <div className="table-wrap mt-3"><table><thead><tr><th>Name</th><th>Status</th><th>Documents</th><th>Total score</th></tr></thead>
            <tbody>{s.participants.map((p, i) => <tr key={i}><td className="font-semibold text-navy">{p.name}</td><td>{ST[p.status] ?? p.status}</td><td><span className={p.docStatus === "valid" ? "badge-ok" : p.docStatus === "rejected" ? "badge-bad" : "badge-warn"}>{p.docStatus === "valid" ? "Valid" : p.docStatus === "rejected" ? "Rejected" : "Under review"}</span></td><td>{p.total ?? "-"}</td></tr>)}</tbody></table></div>
        </section>
      ))}
    </div>
  );
}

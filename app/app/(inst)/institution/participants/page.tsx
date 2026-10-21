"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { ImportPanel } from "@/components/ImportPanel";

type P = { id: string; status: string; name: string | null; email: string; target: number | null; tests: number; firstScore: number | null; lastScore: number | null; lastAt: string | null; branch: string | null; age: number | null };
type D = { participant: { name: string | null; email: string; target: number | null; goal: string | null }; attempts: { id: string; kind: string; scoreEst: number; sections: { section: string; scaled: number }[]; finishedAt: string }[] };
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure", reading: "Reading" };

export default function InstPeserta() {
  const { url, ready, q: q2 } = useInstQuery();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState(""), [age, setAge] = useState(""), [sort, setSort] = useState("name");
  const qs = new URLSearchParams({ page: String(page), sort }); if (q) qs.set("q", q); if (branch) qs.set("branch", branch); if (age) qs.set("age", age);
  const { data, loading, error, reload } = useApi<{ participants: P[]; total: number; page: number; pages: number; branches: string[]; ageGroups: { key: string; label: string }[] }>(url(`/api/inst/participants?${qs}`));
  const Sort = ({ label, asc, desc }: { label: string; asc: string; desc?: string }) => { const on = sort === asc || sort === desc; return <button className={`inline-flex items-center gap-1 font-semibold uppercase ${on ? "text-brand" : ""}`} onClick={() => { setSort(sort === asc && desc ? desc : asc); setPage(1); }}>{label}<span aria-hidden className="text-[10px]">{on ? (sort === desc ? "▼" : "▲") : "↕"}</span></button>; };
  const [sel, setSel] = useState<string | null>(null);
  if (!ready) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Participants & invitations</h1><p className="text-sm text-ink-soft">Add participants and view individual results. Only participants from your institution are shown.</p></div><a className="btn-outline" href={url("/api/inst/report.xlsx") ?? "#"}>Export Excel</a></div>
      <ImportPanel base="/api/inst" query={q2} onDone={reload} />
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><input className="field max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        {(data?.branches.length ?? 0) > 0 && <><select className="field w-auto" aria-label="Branch" value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }}><option value="">All branches</option>{data!.branches.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <select className="field w-auto" aria-label="Age group" value={age} onChange={(e) => { setAge(e.target.value); setPage(1); }}><option value="">All ages</option>{data!.ageGroups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></>}</div>{data && <span className="text-sm text-ink-soft">{data.total.toLocaleString("en-GB")} participants</span>}</div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th><Sort label="Participant" asc="name" /></th><th><Sort label="Branch" asc="branch" /></th><th><Sort label="Age" asc="age" desc="age_desc" /></th><th>Target</th><th>Tests</th><th>First score</th><th><Sort label="Last score" asc="score" desc="score_asc" /></th><th>Last</th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p) => <tr key={p.id}><td className="font-semibold text-navy">{p.name ?? "(no name yet)"}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.status === "invited" ? " · awaiting activation" : ""}</span></td><td className="text-xs">{p.branch ?? "-"}</td><td>{p.age ?? "-"}</td><td>{p.target ?? "-"}</td><td>{p.tests}</td><td>{p.firstScore ?? "-"}</td><td className="font-semibold">{p.lastScore ?? "-"}</td><td>{p.lastAt ? tgl(p.lastAt) : "-"}</td><td className="text-right"><Link href={`/institution/participants/${p.id}`} className="font-semibold text-brand">Dashboard</Link></td></tr>)}
            {data?.participants.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-ink-soft">No participants found.</td></tr>}
          </tbody>
        </table></div>
      )}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-ink-soft">Page {data.page} of {data.pages}</span>
          <button className="btn-outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      {sel && <Detail url={url(`/api/inst/participants/${sel}`)} onClose={() => setSel(null)} />}
    </div>
  );
}

function Detail({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { data, error } = useApi<D>(url);
  return (
    <Modal title="Participant results" onClose={onClose}>
      {!data ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-3 text-sm">
          <p><b className="text-navy">{data.participant.name ?? data.participant.email}</b> · target {data.participant.target ?? "-"}</p>
          {data.attempts.length ? <ul className="divide-y divide-line">{data.attempts.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2"><span>{a.kind} · {tgl(a.finishedAt)}<br /><span className="text-xs text-ink-soft">{a.sections.map((s) => `${SEC[s.section]} ${s.scaled}`).join(" · ")}</span></span><b className="font-display text-xl text-navy">{a.scoreEst}</b></li>)}</ul> : <p className="text-ink-soft">No test results yet.</p>}
        </div>
      )}
    </Modal>
  );
}

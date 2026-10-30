"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pager } from "@/components/Pager";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { DetailModal, STATUS } from "@/components/ParticipantAdminPanel";

type Row = { id: string; name: string | null; email: string; status: string; institution: string | null; level: string | null; scoreEst: number | null; placementDone: boolean; qaTester?: boolean; quota: { used: number; total: number } | null; tests: number; lastAt: string | null; lastLoginAt: string | null; createdAt?: string; branch?: string | null; age?: number | null; pending?: { score: number | null; level: string | null; held: boolean; releaseAt: string } | null };

type Card = { id: string; name: string; code: string; batch: string | null; status: string; total: number; active: number; invited: number; disabled: number; placed: number };
type Opt = { id: string; label: string; test?: string; name?: string };
type F = { q: string; status: string; placement: string; session: string; level: string; branch: string; age: string; sort: string };
const EMPTY: F = { q: "", status: "", placement: "", session: "", level: "", branch: "", age: "", sort: "name" };
const SIZE_KEY = "ei-participants-size";

export default function Peserta() {
  const initial = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [inst, setInstState] = useState<string>(initial.get("institution") ?? "");
  const [f, setF] = useState<F>({ ...EMPTY, status: initial.get("status") ?? "" });
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSizeState] = useState(() => { try { return Number(localStorage.getItem(SIZE_KEY)) || 50; } catch { return 50; } });
  const setSize = (n: number) => { setSizeState(n); setPage(1); try { localStorage.setItem(SIZE_KEY, String(n)); } catch { /* */ } };
  const setInst = (id: string) => { setInstState(id); setPage(1); try { const u = new URL(window.location.href); if (id) u.searchParams.set("institution", id); else u.searchParams.delete("institution"); history.replaceState(null, "", u); } catch { /* */ } };
  const set = (patch: Partial<F>) => { setF({ ...f, ...patch }); setPage(1); };
  // Ketik dulu, cari setelah jeda singkat (tidak memuat ulang di setiap huruf).
  useEffect(() => { const t = setTimeout(() => { if (qInput !== f.q) set({ q: qInput }); }, 350); return () => clearTimeout(t); }); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = useApi<{ cards: Card[] }>("/api/admin/participants/summary");
  const filtered = !!(f.q || f.status || f.placement || f.session || f.level || f.branch || f.age);
  const showCards = !inst && !filtered;
  const qs = new URLSearchParams({ page: String(page), size: String(size), sort: f.sort });
  if (inst) qs.set("institution", inst);
  (["q", "status", "placement", "session", "level", "branch", "age"] as const).forEach((k) => { if (f[k]) qs.set(k, f[k]); });
  const { data, loading, error, reload } = useApi<{ participants: Row[]; total: number; pages: number; levels: Opt[]; sessions: Opt[]; branches: string[]; ageGroups: { key: string; label: string }[] }>(showCards ? null : `/api/admin/participants?${qs}`);
  const [opts, setOpts] = useState<{ levels: Opt[]; sessions: Opt[]; branches: string[]; ageGroups: { key: string; label: string }[] }>({ levels: [], sessions: [], branches: [], ageGroups: [] });
  useEffect(() => { if (data) setOpts({ levels: data.levels, sessions: data.sessions, branches: data.branches ?? [], ageGroups: data.ageGroups ?? [] }); }, [data]);
  const card = cards.data?.cards.find((c) => c.id === inst);
  const [sel, setSel] = useState<string | null>(null);
  const goPage = (p: number) => { setPage(p); window.scrollTo?.({ top: 0 }); document.querySelector("main")?.scrollTo?.({ top: 0 }); };
  const reset = () => { setF(EMPTY); setQInput(""); setPage(1); };

  // Judul kolom yang bisa diklik untuk mengurutkan.
  const Sort = ({ label, asc, desc }: { label: string; asc: string; desc?: string }) => {
    const on = f.sort === asc || f.sort === desc;
    const next = f.sort === asc && desc ? desc : asc;
    return <button className={`inline-flex items-center gap-1 font-semibold uppercase ${on ? "text-brand" : ""}`} onClick={() => set({ sort: next })} title={`Sort by ${label.toLowerCase()}`}>{label}<span aria-hidden className="text-[10px]">{on ? (f.sort === desc ? "▼" : "▲") : "↕"}</span></button>;
  };
  const sel_ = "field w-auto min-w-[150px]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        {inst && <button className="text-sm font-semibold text-brand" onClick={() => { setInst(""); reset(); }}>← All institutions</button>}
        <h1 className="page-title">{card ? card.name : "Participants"}</h1>
        <p className="text-sm text-ink-soft">{card ? `${card.total.toLocaleString("en-US")} participants · ${card.active} active · ${card.invited} awaiting activation · ${card.disabled} inactive` : showCards ? "Choose an institution to see its participants, or search everyone by name or email. Participants are added from the Institutions menu." : "Results across all institutions"}</p>
      </div>

      <section className={`flex flex-col gap-3 ${showCards ? "" : "card"}`} aria-label="Filters">
        <div className="flex flex-wrap items-center gap-2">
          <input className="field min-w-[240px] flex-1 sm:max-w-sm" type="search" placeholder={inst ? "Search name or email" : "Search everyone by name or email"} value={qInput} onChange={(e) => setQInput(e.target.value)} aria-label="Search" />
          <select className={sel_} aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All statuses</option><option value="active">Active</option><option value="invited">Awaiting activation</option><option value="disabled">Inactive</option></select>
          {!showCards && <>
            <select className={sel_} aria-label="Placement" value={f.placement} onChange={(e) => set({ placement: e.target.value })}><option value="">Placement: all</option><option value="done">Placement done</option><option value="none">No placement yet</option></select>
            {opts.sessions.length > 0 && <select className={sel_} aria-label="Scheduled session" value={f.session} onChange={(e) => set({ session: e.target.value })}><option value="">Any test date</option>{opts.sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>}
            {opts.levels.length > 0 && <select className={sel_} aria-label="Level" value={f.level} onChange={(e) => set({ level: e.target.value })}><option value="">All levels</option>{opts.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            {opts.branches.length > 0 && <select className={sel_} aria-label="Branch" value={f.branch} onChange={(e) => set({ branch: e.target.value })}><option value="">All branches</option>{opts.branches.map((b) => <option key={b} value={b}>{b}</option>)}</select>}
            {opts.branches.length > 0 && <select className={sel_} aria-label="Age group" value={f.age} onChange={(e) => set({ age: e.target.value })}><option value="">All ages</option>{opts.ageGroups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>}
          </>}
          {filtered && <button className="text-sm font-semibold text-brand" onClick={reset}>Clear filters</button>}
        </div>
        {!showCards && data && <Pager page={page} pages={data.pages} total={data.total} size={size} onPage={goPage} onSize={setSize} />}
      </section>

      <ErrorNote text={error || cards.error} />
      {showCards ? (cards.loading && !cards.data ? <Loading /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.data?.cards.map((c) => (
            <button key={c.id} onClick={() => setInst(c.id)} className="card flex flex-col gap-3 text-left transition hover:border-brand hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-display text-lg font-extrabold text-navy">{c.name}</h2><p className="text-xs text-ink-soft">{[c.code, c.batch].filter(Boolean).join(" · ") || "Participants without an institution"}</p></div>
                {c.status !== "active" && <span className="badge-muted">Inactive</span>}
              </div>
              <p className="font-display text-3xl font-extrabold text-navy">{c.total.toLocaleString("en-US")}<span className="ml-1 text-sm font-semibold text-ink-soft">{c.total === 1 ? "participant" : "participants"}</span></p>
              <div className="flex flex-wrap gap-1.5 text-xs"><span className="badge-ok">{c.active} active</span>{c.invited > 0 && <span className="badge-warn">{c.invited} awaiting activation</span>}{c.disabled > 0 && <span className="badge-muted">{c.disabled} inactive</span>}</div>
              <div><p className="flex justify-between text-xs text-ink-soft"><span>Placement done</span><span className="font-semibold text-navy">{c.placed} / {c.total}</span></p>
                <div className="mt-1 h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-brand" style={{ width: `${c.total ? Math.round((c.placed / c.total) * 100) : 0}%` }} /></div></div>
              <span className="text-sm font-semibold text-brand">Open participants →</span>
            </button>
          ))}
          {cards.data?.cards.length === 0 && <p className="card text-sm text-ink-soft">No institutions yet.</p>}
        </div>
      )) : loading && !data ? <Loading /> : (
        <div className={`table-wrap transition-opacity ${loading ? "opacity-60" : ""}`}><table>
          <thead><tr><th><Sort label="Participant" asc="name" desc="name_desc" /></th><th><Sort label="Status" asc="status" /></th><th><Sort label="Branch" asc="branch" /></th><th><Sort label="Age" asc="age" desc="age_desc" /></th><th>Level</th><th><Sort label="Score" asc="score" desc="score_asc" /></th><th>Coaching quota</th><th>Tests</th><th><Sort label="Joined" asc="newest" /></th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p, i) => (
              <tr key={p.id}>
                <td className="font-semibold text-navy"><span className="mr-2 text-xs font-normal text-ink-soft">{(page - 1) * size + i + 1}.</span>{p.name ?? "(no name yet)"}{p.qaTester && <span className="ml-2 rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent-dark">QA</span>}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.institution && !inst ? ` · ${p.institution}` : ""}</span></td>
                <td><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span></td>
                <td className="text-xs">{p.branch ?? "-"}</td><td>{p.age ?? "-"}</td>
                <td>{p.level ?? p.pending?.level ?? (p.placementDone ? "-" : "No placement yet")}{!p.level && p.pending && <span className="block text-[11px] text-accent-dark" title="The participant cannot see this result yet">{p.pending.held ? "held (not released)" : `releases ${new Date(p.pending.releaseAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`}</span>}</td><td>{p.scoreEst ?? p.pending?.score ?? "-"}</td><td>{p.quota ? `${p.quota.used}/${p.quota.total}` : "-"}</td><td>{p.tests}</td>
                <td className="text-xs text-ink-soft">{p.createdAt ? tgl(p.createdAt) : "-"}</td>
                <td className="whitespace-nowrap text-right"><Link href={`/admin/participants/${p.id}`} className="mr-3 font-semibold text-brand">Dashboard</Link><button className="font-semibold text-brand" onClick={() => setSel(p.id)}>Manage</button></td>
              </tr>
            ))}
            {data?.participants.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-ink-soft">No participants match these filters. {filtered && <button className="font-semibold text-brand" onClick={reset}>Clear filters</button>}</td></tr>}
          </tbody>
        </table></div>
      )}
      {!showCards && data && data.pages > 1 && <Pager page={page} pages={data.pages} total={data.total} size={size} onPage={goPage} onSize={setSize} />}
      {sel && <DetailModal id={sel} onClose={() => { setSel(null); reload(); }} />}
    </div>
  );
}

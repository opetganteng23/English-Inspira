"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { Pager } from "@/components/Pager";

type Issue = { code: string; label: string; level: "bad" | "warn" | "info" };
type Row = {
  id: string; name: string; email: string; institution: string; session: string;
  status: "in_progress" | "submitted"; startedAt: string; finishedAt: string | null; minutes: number | null;
  section: number; sectionName: string; sections: number; answered: number; total: number;
  score: number | null; lastSeen: string | null; live: "active" | "unstable" | "offline" | null;
  tab: number; fullscreen: number; paste: number; lost: number; gaps: number; gapMaxMin: number; loads: number;
  issues: Issue[]; risk: number; review: string | null; reviewNote: string | null;
  screen?: "shared" | "stopped" | "unsupported" | "denied" | "none" | null; screenAt?: number | null; screenImg?: boolean;
};
type Resp = { tests: { id: string; name: string; live: number }[]; data: { test: { id: string; name: string; total: number; limitMin: number; screenWatch?: boolean }; rows: Row[]; at: string } | null };
type Finding = { level: "bad" | "warn" | "info" | "ok"; title: string; detail: string };
type Trace = {
  findings: Finding[]; loads: number; gaps: { from: string; to: string; section: number }[];
  sections: { name: string; answered: number; total: number; correct: number; minutes: number; limit: number }[];
  summary: { tabHidden: number; fullscreenExit: number; paste: number; guesses: number; changed: number; unanswered: number; minutes: number | null };
  attempt: { status: string; startedAt: string; finishedAt: string | null; scoreEst: number | null };
};

const RV: Record<string, [string, string]> = { clean: ["Clean", "badge-ok"], suspicious: ["Suspicious", "badge-warn"], invalid: ["Invalid", "badge-bad"] };
const LIVE: Record<string, [string, string]> = { active: ["Active", "bg-success"], unstable: ["Unstable", "bg-accent"], offline: ["Disconnected", "bg-red-600"] };
const CHIP: Record<Issue["level"], string> = { bad: "badge-bad", warn: "badge-warn", info: "badge-muted" };
const PROBLEMS: [string, string][] = [["any", "Any problem"], ["locked", "Section started mid-way (system fault)"], ["offline", "Disconnected now"], ["gap", "Connection lost"], ["lost", "Blanks between answers (lost or skipped)"], ["blank", "Many blanks"], ["fast", "Finished fast"], ["tab", "Tab switches"], ["fullscreen", "Left fullscreen"], ["paste", "Paste"], ["reload", "Reopened"], ["none", "No problems"]];
const clock = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const ago = (d: string | null, now: number) => {
  if (!d) return "-";
  const s = Math.max(0, Math.round((now - +new Date(d)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
};
type SortKey = "name" | "session" | "status" | "progress" | "seen" | "score" | "risk";

export type BoardApi = { list: (qs: string) => string | null; trace: (id: string) => string | null; screen?: (id: string) => string | null; canReview: boolean; timeline?: (id: string) => string };
/** Monitoring & Proctoring: satu tabel untuk peserta yang sedang tes dan yang sudah selesai; cari, filter, urutkan, lalu buka trace per peserta. */
export function MonitoringBoard({ apis }: { apis: BoardApi }) {
  const [test, setTest] = useState("");
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [problem, setProblem] = useState("all");
  const [review, setReview] = useState("all");
  const [session, setSession] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "risk", dir: -1 });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Row | null>(null);
  const [view, setView] = useState<"table" | "screens">("table");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const u = apis.list(test ? `test=${test}` : ""); if (!u) return;
    try { setResp(await api<Resp>(u)); setError(""); setNow(Date.now()); } catch (e) { setError((e as Error).message); }
  }, [test, apis]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!auto) return; const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [auto, load]);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 5_000); return () => clearInterval(iv); }, []);
  useEffect(() => setPage(1), [q, status, problem, review, session, test]);

  const rows = useMemo(() => resp?.data?.rows ?? [], [resp]);
  const sessions = useMemo(() => [...new Set(rows.map((r) => r.session).filter(Boolean))].sort(), [rows]);
  const needs = (r: Row) => r.status === "submitted" && !r.review && r.issues.some((i) => i.level !== "info");
  const kpi = {
    live: rows.filter((r) => r.status === "in_progress").length,
    offline: rows.filter((r) => r.live === "offline").length,
    done: rows.filter((r) => r.status === "submitted").length,
    needs: rows.filter(needs).length,
    lost: rows.filter((r) => r.lost > 0).length,
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (s && !`${r.name} ${r.email} ${r.institution}`.toLowerCase().includes(s)) return false;
      if (status === "in_progress" && r.status !== "in_progress") return false;
      if (status === "submitted" && r.status !== "submitted") return false;
      if (status === "needs" && !needs(r)) return false;
      if (session !== "all" && r.session !== session) return false;
      if (review === "none" && r.review) return false;
      if (review !== "all" && review !== "none" && r.review !== review) return false;
      if (problem === "any" && !r.issues.length) return false;
      if (problem === "none" && r.issues.length) return false;
      if (problem !== "all" && problem !== "any" && problem !== "none" && !r.issues.some((i) => i.code === problem)) return false;
      return true;
    });
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "name": return r.name.toLowerCase();
        case "session": return r.session;
        case "status": return r.status === "in_progress" ? ({ offline: 0, unstable: 1, active: 2 }[r.live ?? "active"]) : 3;
        case "progress": return r.section * 1000 + r.answered;
        case "seen": return r.status === "in_progress" ? +new Date(r.lastSeen ?? 0) : +new Date(r.finishedAt ?? 0);
        case "score": return r.score ?? -1;
        default: return r.risk;
      }
    };
    return list.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name); });
  }, [rows, q, status, problem, review, session, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const shown = filtered.slice((page - 1) * size, page * size);

  const setKpi = (st: string, pr = "all") => { setStatus(st); setProblem(pr); setReview("all"); };
  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="inline-flex items-center gap-1 font-semibold" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" || key === "session" ? 1 : -1 }))}>
        {label}<span className="text-xs text-ink-soft">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  async function bulk(st: string) {
    const ids = [...sel].filter((id) => rows.find((r) => r.id === id)?.status === "submitted");
    if (!ids.length) { setMsg("Only finished tests can be reviewed."); return; }
    try { await api("/api/admin/proctoring", { method: "PATCH", json: { ids, status: st } }); setSel(new Set()); setMsg(`${ids.length} marked ${RV[st][0].toLowerCase()}.`); void load(); } catch (e) { setMsg((e as Error).message); }
  }
  function exportCsv() {
    const head = ["Name", "Email", "Institution", "Session", "Status", "Section", "Answered", "Total", "Score", "Minutes", "Last seen", "Problems", "Risk", "Review"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [r.name, r.email, r.institution, r.session, r.status === "in_progress" ? `In progress (${r.live})` : "Finished", r.sectionName, r.answered, r.total, r.score, r.minutes, r.lastSeen ? clock(r.lastSeen) : "", r.issues.map((i) => i.label).join("; "), r.risk, r.review ?? ""].map(esc).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `monitoring-${(resp?.data?.test.name ?? "test").replace(/\W+/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const allOnPage = shown.length > 0 && shown.every((r) => sel.has(r.id));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Monitoring &amp; Proctoring</h1>
          <p className="text-sm text-ink-soft">Live status of participants taking a test, and automatic problem detection for review. No camera or microphone.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Test" className="field !w-auto" value={test || resp?.data?.test.id || ""} onChange={(e) => { setTest(e.target.value); setSel(new Set()); }}>
            {resp?.tests.map((t) => <option key={t.id} value={t.id}>{t.name}{t.live ? ` · ${t.live} live` : ""}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Auto-refresh</label>
          <button className="btn-outline !min-h-[40px]" onClick={() => void load()}>Refresh</button>
        </div>
      </div>
      <ErrorNote text={error} />
      {!resp ? <Loading /> : !resp.data ? <div className="card py-10 text-center text-ink-soft">No test attempts yet.</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {([
              ["IN PROGRESS", kpi.live, () => setKpi("in_progress"), "text-navy"],
              ["DISCONNECTED NOW", kpi.offline, () => setKpi("in_progress", "offline"), kpi.offline ? "text-red-700" : "text-navy"],
              ["FINISHED", kpi.done, () => setKpi("submitted"), "text-navy"],
              ["NEEDS REVIEW", kpi.needs, () => setKpi("needs"), kpi.needs ? "text-accent" : "text-navy"],
              ["BLANKS BETWEEN ANSWERS", kpi.lost, () => setKpi("all", "lost"), kpi.lost ? "text-red-700" : "text-navy"],
            ] as const).map(([l, n, fn, c]) => (
              <button key={l} onClick={fn} className="card !p-4 text-left transition hover:border-brand">
                <p className="text-xs font-semibold tracking-wider text-ink-soft">{l}</p>
                <p className={`mt-1 font-display text-3xl font-extrabold ${c}`}>{n.toLocaleString("en-US")}</p>
              </button>
            ))}
          </div>

          <div className="card flex flex-col gap-3 !p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Search" className="field min-w-[220px] flex-1" placeholder="Search name, email or institution" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="Status" className="field !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option><option value="in_progress">In progress</option><option value="submitted">Finished</option><option value="needs">Needs review</option>
              </select>
              <select aria-label="Problem" className="field !w-auto" value={problem} onChange={(e) => setProblem(e.target.value)}>
                <option value="all">All problems</option>{PROBLEMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select aria-label="Review" className="field !w-auto" value={review} onChange={(e) => setReview(e.target.value)}>
                <option value="all">Any review</option><option value="none">Not reviewed</option>{Object.entries(RV).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
              {sessions.length > 1 && <select aria-label="Session" className="field !w-auto" value={session} onChange={(e) => setSession(e.target.value)}><option value="all">All sessions</option>{sessions.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
              {(q || status !== "all" || problem !== "all" || review !== "all" || session !== "all") && <button className="text-sm font-semibold text-brand" onClick={() => { setQ(""); setStatus("all"); setProblem("all"); setReview("all"); setSession("all"); }}>Clear</button>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
              <span><b className="text-navy">{filtered.length.toLocaleString("en-US")}</b> of {rows.length.toLocaleString("en-US")} participants · updated {clock(resp.data.at)} WIB</span>
              <div className="flex flex-wrap items-center gap-2">
                {apis.canReview && sel.size > 0 && <><span className="font-semibold text-navy">{sel.size} selected</span><button className="btn-outline !min-h-[36px]" onClick={() => bulk("clean")}>Mark clean</button><button className="btn-accent !min-h-[36px]" onClick={() => bulk("suspicious")}>Mark suspicious</button><button className="text-sm font-semibold text-ink-soft" onClick={() => setSel(new Set())}>Clear selection</button></>}
                <button className="btn-outline !min-h-[36px]" onClick={exportCsv}>Export CSV</button>
              </div>
            </div>
            {msg && <p className="text-sm text-navy" role="status">{msg}</p>}
          </div>

          {resp.data.test.screenWatch && apis.screen && (
            <div className="flex gap-1 self-start rounded-lg bg-white p-1 text-sm" role="tablist" aria-label="View">
              {([["table", "Table"], ["screens", "Live screens"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-3 py-1.5 font-semibold ${view === k ? "bg-navy text-white" : "text-ink-soft"}`}>{l}</button>)}
            </div>
          )}
          {view === "screens" && resp.data.test.screenWatch && apis.screen ? <ScreenGrid rows={filtered.filter((r) => r.status === "in_progress")} src={apis.screen} onOpen={setOpen} /> : <>
          <div className="table-wrap card !p-0">
            <table className="w-full text-sm">
              <thead><tr>
                {apis.canReview && <th className="w-10"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={(e) => { const n = new Set(sel); shown.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id))); setSel(n); }} /></th>}
                {th("name", "Participant")}{th("session", "Session")}{th("status", "Status")}{th("progress", "Progress")}{th("seen", "Last seen")}{th("score", "Score", "text-right")}<th>Problems</th>{th("risk", "Risk", "text-right")}<th>Review</th>
              </tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={`cursor-pointer hover:bg-brand-tint ${open?.id === r.id ? "bg-brand-tint" : ""}`} onClick={() => setOpen(r)}>
                    {apis.canReview && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.has(r.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.id); else n.delete(r.id); setSel(n); }} /></td>}
                    <td className="min-w-[200px]"><p className="font-semibold text-navy">{r.name || r.email}</p><p className="text-xs text-ink-soft">{r.email}</p></td>
                    <td className="whitespace-nowrap text-xs">{r.session || "-"}</td>
                    <td className="whitespace-nowrap">{r.status === "in_progress" ? <span className="inline-flex items-center gap-1.5 font-semibold text-navy"><span className={`h-2.5 w-2.5 rounded-full ${LIVE[r.live ?? "active"][1]}`} aria-hidden />{LIVE[r.live ?? "active"][0]}</span> : <span className="text-ink-soft">Finished</span>}</td>
                    <td className="min-w-[150px]">
                      <p className="text-xs text-ink-soft">{r.status === "in_progress" ? `${r.sectionName} (${r.section + 1}/${r.sections})` : `${r.minutes ?? "-"} min`}</p>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-line"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.round((r.answered / Math.max(1, r.total)) * 100)}%` }} /></div>
                      <p className="mt-0.5 text-xs text-ink-soft">{r.answered}/{r.total} answered</p>
                    </td>
                    <td className="whitespace-nowrap text-xs">{r.status === "in_progress" ? ago(r.lastSeen, now) : r.finishedAt ? `${clock(r.finishedAt)} WIB` : "-"}</td>
                    <td className="text-right font-semibold text-navy">{r.score ?? "-"}</td>
                    <td className="min-w-[180px]"><div className="flex flex-wrap gap-1">{r.issues.slice(0, 3).map((i) => <span key={i.code} className={`${CHIP[i.level]} !text-[11px]`}>{i.label}</span>)}{r.issues.length > 3 && <span className="badge-muted !text-[11px]">+{r.issues.length - 3}</span>}{!r.issues.length && <span className="text-xs text-success">OK</span>}</div></td>
                    <td className="text-right"><span className={`inline-block min-w-[36px] rounded-md px-2 py-0.5 text-center text-xs font-bold ${r.risk >= 40 ? "bg-red-100 text-red-700" : r.risk >= 15 ? "bg-accent-tint text-navy" : "bg-canvas text-ink-soft"}`}>{r.risk}</span></td>
                    <td>{r.review ? <span className={RV[r.review]?.[1] ?? "badge-muted"}>{RV[r.review]?.[0] ?? r.review}</span> : <span className="text-xs text-ink-soft">-</span>}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={10} className="py-10 text-center text-ink-soft">No participants match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} total={filtered.length} size={size} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
          </>}
        </>
      )}
      {open && <TracePanel row={open} apis={apis} onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </div>
  );
}

const SCREEN: Record<string, [string, string]> = { shared: ["Sharing", "bg-success"], stopped: ["Share stopped", "bg-red-600"], denied: ["Share refused", "bg-red-600"], none: ["Not shared yet", "bg-accent"], unsupported: ["Phone/tablet: no share", "bg-ink-soft"] };
const withT = (u: string, t: number) => `${u}${u.includes("?") ? "&" : "?"}t=${t}`;

/** Grid layar live peserta yang sedang tes (gambar dari memori server, diperbarui tiap ±10 detik; tidak direkam). */
function ScreenGrid({ rows, src, onOpen }: { rows: Row[]; src: (id: string) => string | null; onOpen: (r: Row) => void }) {
  const [t, setT] = useState(() => Date.now());
  const [big, setBig] = useState<Row | null>(null);
  useEffect(() => { const iv = setInterval(() => setT(Date.now()), 10_000); return () => clearInterval(iv); }, []);
  const sorted = [...rows].sort((a, b) => (a.screen === "shared" ? 1 : 0) - (b.screen === "shared" ? 1 : 0) || a.name.localeCompare(b.name));
  if (!rows.length) return <div className="card py-10 text-center text-ink-soft">No one is taking this test right now.</div>;
  return (
    <>
      <p className="text-sm text-ink-soft">Live view only: each screen refreshes about every 10 seconds and nothing is recorded or stored. Problems (share stopped, not shared) are listed first.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {sorted.map((r) => {
          const u = src(r.id);
          return (
            <div key={r.id} className="card flex flex-col gap-2 !p-3">
              <button className="relative aspect-video w-full overflow-hidden rounded-lg bg-canvas" onClick={() => setBig(r)} aria-label={`Enlarge screen of ${r.name}`}>
                {r.screen === "shared" && r.screenImg && u ? <img src={withT(u, t)} alt={`Screen of ${r.name}`} className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center text-sm text-ink-soft">{r.screen === "shared" ? "Waiting for image…" : SCREEN[r.screen ?? "none"]?.[0] ?? "No image"}</span>}
              </button>
              <div className="flex items-center justify-between gap-2 text-sm">
                <button className="truncate text-left font-semibold text-navy" onClick={() => onOpen(r)} title="Open trace">{r.name || r.email}</button>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-soft"><span className={`h-2 w-2 rounded-full ${SCREEN[r.screen ?? "none"]?.[1] ?? "bg-ink-soft"}`} />{SCREEN[r.screen ?? "none"]?.[0]}</span>
              </div>
              <p className="text-xs text-ink-soft">{r.sectionName} · {r.answered}/{r.total} answered{r.tab ? ` · tab switch ×${r.tab}` : ""}</p>
            </div>
          );
        })}
      </div>
      {big && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setBig(null)} role="dialog" aria-modal="true" aria-label={`Screen of ${big.name}`}>
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white"><b>{big.name}</b><button className="text-2xl leading-none" onClick={() => setBig(null)} aria-label="Close">×</button></div>
            {src(big.id) ? <LiveFrame url={src(big.id)!} name={big.name} /> : null}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Layar diperbesar: meminta mode HD live (peserta mengirim gambar tajam tiap 1 detik selama ditonton) dan
 * menampilkan gambar baru setelah selesai dimuat (tanpa kedip). Tidak ada yang direkam.
 */
function LiveFrame({ url, name }: { url: string; name: string }) {
  const [shown, setShown] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  useEffect(() => {
    let alive = true, last = "";
    const pull = () => {
      const u = `${withT(url, Date.now())}&focus=1`;
      const im = new Image();
      im.onload = () => { if (!alive) return; setShown(u); last = u; setAge(Date.now()); };
      im.src = u;
    };
    pull();
    const iv = setInterval(pull, 1000);
    return () => { alive = false; clearInterval(iv); void last; };
  }, [url]);
  const [, force] = useState(0);
  useEffect(() => { const iv = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(iv); }, []);
  const lag = age ? Math.round((Date.now() - age) / 1000) : null;
  return (
    <>
      {shown ? <img src={shown} alt={`Screen of ${name}`} className="w-full rounded-lg bg-black" /> : <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-black text-sm text-white/70">Connecting to live view…</div>}
      <p className="mt-2 flex items-center gap-2 text-xs text-white/80"><span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 font-bold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE HD</span>Updates every second while open{lag != null && lag > 3 ? ` · last frame ${lag}s ago (participant connection)` : ""}. Live only, not recorded.</p>
    </>
  );
}

const LV: Record<Finding["level"], [string, string]> = { bad: ["border-red-600", "text-red-700"], warn: ["border-accent", "text-navy"], info: ["border-brand", "text-navy"], ok: ["border-success", "text-success"] };

/** Panel samping: diagnosis otomatis satu peserta, ringkasan per bagian, jeda koneksi, dan tinjauan. */
function TracePanel({ row, apis, onClose, onChanged }: { row: Row; apis: BoardApi; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Trace | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState(row.reviewNote ?? "");
  const [rv, setRv] = useState(row.review);
  useEffect(() => {
    setD(null); setErr(""); setNote(row.reviewNote ?? ""); setRv(row.review);
    const u = apis.trace(row.id); if (u) api<Trace>(u).then(setD).catch((e) => setErr((e as Error).message));
  }, [row.id, row.review, row.reviewNote, apis]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  async function setReview(status: string) {
    setErr("");
    try { await api("/api/admin/proctoring", { method: "PATCH", json: { id: row.id, status, note: note || undefined } }); setRv(status); onChanged(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Trace for ${row.name}`} className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand">TRACE</p>
            <h2 className="font-display text-xl font-extrabold text-navy">{row.name || row.email}</h2>
            <p className="text-sm text-ink-soft">{row.email}{row.session ? ` · ${row.session}` : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center text-2xl leading-none text-ink-soft">×</button>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <ErrorNote text={err} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Status</p><p className="font-semibold text-navy">{row.status === "in_progress" ? LIVE[row.live ?? "active"][0] : "Finished"}</p></div>
            <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Score</p><p className="font-semibold text-navy">{row.score ?? "-"}</p></div>
            <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Started</p><p className="font-semibold text-navy">{clock(row.startedAt)}{row.finishedAt ? `–${clock(row.finishedAt)}` : ""}</p></div>
          </div>
          {!d ? <Loading /> : (
            <>
              <section>
                <h3 className="mb-2 font-display text-base font-extrabold text-navy">Diagnosis</h3>
                <ul className="flex flex-col gap-2">{d.findings.map((f, i) => (
                  <li key={i} className={`rounded-lg border-l-4 bg-canvas px-3 py-2 ${LV[f.level][0]}`}><p className={`font-semibold ${LV[f.level][1]}`}>{f.title}</p><p className="text-sm text-ink-soft">{f.detail}</p></li>
                ))}</ul>
              </section>
              <section>
                <h3 className="mb-2 font-display text-base font-extrabold text-navy">Sections</h3>
                <div className="table-wrap"><table className="w-full text-sm"><thead><tr><th>Section</th><th className="text-right">Answered</th><th className="text-right">Correct</th><th className="text-right">Time</th></tr></thead>
                  <tbody>{d.sections.map((s) => <tr key={s.name}><td className="font-semibold text-navy">{s.name}</td><td className="text-right">{s.answered}/{s.total}</td><td className="text-right">{d.attempt.status === "submitted" && d.attempt.scoreEst != null ? s.correct : "-"}</td><td className="text-right">{s.minutes}/{s.limit} min</td></tr>)}</tbody></table></div>
              </section>
              <section className="grid grid-cols-3 gap-2 text-center text-sm">
                {([["Tab switches", d.summary.tabHidden], ["Left fullscreen", d.summary.fullscreenExit], ["Paste", d.summary.paste], ["Likely guesses", d.summary.guesses], ["Answers changed", d.summary.changed], ["Page opened", d.loads || "-"]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-line p-2"><p className="text-xs text-ink-soft">{l}</p><p className="font-display text-lg font-extrabold text-navy">{v}</p></div>
                ))}
              </section>
              {d.gaps.length > 0 && <section><h3 className="mb-2 font-display text-base font-extrabold text-navy">Connection gaps</h3><ul className="flex flex-col divide-y divide-line text-sm">{d.gaps.map((g, i) => <li key={i} className="flex justify-between py-1.5"><span>{d.sections[g.section]?.name ?? "Section"}</span><span className="font-semibold text-navy">{clock(g.from)}–{clock(g.to)} WIB · {Math.max(1, Math.round((+new Date(g.to) - +new Date(g.from)) / 60000))} min</span></li>)}</ul></section>}
              {apis.timeline && <Link href={apis.timeline(row.id)} className="text-sm font-semibold text-brand">Open full activity timeline (per question) →</Link>}
            </>
          )}
          {apis.canReview && row.status === "submitted" && (
            <section className="flex flex-col gap-2 border-t border-line pt-4">
              <h3 className="font-display text-base font-extrabold text-navy">Review {rv && <span className={`ml-2 align-middle ${RV[rv]?.[1] ?? "badge-muted"}`}>{RV[rv]?.[0] ?? rv}</span>}</h3>
              <input aria-label="Review note" className="field" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">{Object.entries(RV).map(([k, [l]]) => <button key={k} className={k === "clean" ? "btn-outline" : k === "suspicious" ? "btn-accent" : "btn-danger"} onClick={() => setReview(k)}>{l}</button>)}</div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

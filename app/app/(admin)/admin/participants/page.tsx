"use client";

import { useEffect, useState } from "react";
import { Pager } from "@/components/Pager";
import { useApi } from "@/lib/useApi";
import { askConfirm } from "@/components/Feedback";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { EditAccountDialog, ResetPasswordDialog, DeleteAccountDialog } from "@/components/AccountDialogs";

type Row = { id: string; name: string | null; email: string; status: string; institution: string | null; level: string | null; scoreEst: number | null; placementDone: boolean; qaTester?: boolean; quota: { used: number; total: number } | null; tests: number; lastAt: string | null; lastLoginAt: string | null; createdAt?: string; pending?: { score: number | null; level: string | null; held: boolean; releaseAt: string } | null };
type Detail = {
  profile: { id: string; name?: string; givenName?: string; surname?: string; email: string; phone?: string; status: string; institution: string | null; consentAt: string | null; lastLoginAt: string | null; createdAt: string; level: string | null; scoreEst: number | null; placementDone: boolean; placementRetakeAllowed: boolean; qaTester?: boolean };
  enrollment: { status: string; startsAt: string; expiresAt: string | null } | null;
  quotas: { level: string; used: number; total: number; active: boolean }[];
  attempts: { id: string; kind: string; scoreEst: number; finishedAt: string; flags: number; held?: boolean }[];
  notes: { text: string; at: string }[];
};
const STATUS: Record<string, [string, string]> = { invited: ["Awaiting activation", "badge-warn"], active: ["Active", "badge-ok"], disabled: ["Inactive", "badge-muted"] };

type Card = { id: string; name: string; code: string; batch: string | null; status: string; total: number; active: number; invited: number; disabled: number; placed: number };
type Opt = { id: string; label: string; test?: string; name?: string };
type F = { q: string; status: string; placement: string; session: string; level: string; sort: string };
const EMPTY: F = { q: "", status: "", placement: "", session: "", level: "", sort: "name" };
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
  const filtered = !!(f.q || f.status || f.placement || f.session || f.level);
  const showCards = !inst && !filtered;
  const qs = new URLSearchParams({ page: String(page), size: String(size), sort: f.sort });
  if (inst) qs.set("institution", inst);
  (["q", "status", "placement", "session", "level"] as const).forEach((k) => { if (f[k]) qs.set(k, f[k]); });
  const { data, loading, error, reload } = useApi<{ participants: Row[]; total: number; pages: number; levels: Opt[]; sessions: Opt[] }>(showCards ? null : `/api/admin/participants?${qs}`);
  const [opts, setOpts] = useState<{ levels: Opt[]; sessions: Opt[] }>({ levels: [], sessions: [] });
  useEffect(() => { if (data) setOpts({ levels: data.levels, sessions: data.sessions }); }, [data]);
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
          <thead><tr><th><Sort label="Participant" asc="name" desc="name_desc" /></th><th><Sort label="Status" asc="status" /></th><th>Level</th><th><Sort label="Score" asc="score" desc="score_asc" /></th><th>Coaching quota</th><th>Tests</th><th><Sort label="Joined" asc="newest" /></th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p, i) => (
              <tr key={p.id}>
                <td className="font-semibold text-navy"><span className="mr-2 text-xs font-normal text-ink-soft">{(page - 1) * size + i + 1}.</span>{p.name ?? "(no name yet)"}{p.qaTester && <span className="ml-2 rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent-dark">QA</span>}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.institution && !inst ? ` · ${p.institution}` : ""}</span></td>
                <td><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span></td>
                <td>{p.level ?? p.pending?.level ?? (p.placementDone ? "-" : "No placement yet")}{!p.level && p.pending && <span className="block text-[11px] text-accent-dark" title="The participant cannot see this result yet">{p.pending.held ? "held (not released)" : `releases ${new Date(p.pending.releaseAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`}</span>}</td><td>{p.scoreEst ?? p.pending?.score ?? "-"}</td><td>{p.quota ? `${p.quota.used}/${p.quota.total}` : "-"}</td><td>{p.tests}</td>
                <td className="text-xs text-ink-soft">{p.createdAt ? tgl(p.createdAt) : "-"}</td>
                <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(p.id)}>Detail</button></td>
              </tr>
            ))}
            {data?.participants.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-ink-soft">No participants match these filters. {filtered && <button className="font-semibold text-brand" onClick={reset}>Clear filters</button>}</td></tr>}
          </tbody>
        </table></div>
      )}
      {!showCards && data && data.pages > 1 && <Pager page={page} pages={data.pages} total={data.total} size={size} onPage={goPage} onSize={setSize} />}
      {sel && <DetailModal id={sel} onClose={() => { setSel(null); reload(); }} />}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: d, error, reload } = useApi<Detail>(`/api/admin/participants/${id}`);
  const [note, setNote] = useState("");
  const [ext, setExt] = useState({ days: 30, reason: "" });
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dlg, setDlg] = useState<"edit" | "reset" | "delete" | null>(null);
  const run = async (body: Record<string, unknown>, ok?: string) => {
    setErr(""); setMsg("");
    try { await api(`/api/admin/participants/${id}`, { json: body }); if (ok) setMsg(ok); reload(); } catch (e) { setErr((e as Error).message); }
  };
  const p = d?.profile;

  return (
    <Modal title="Participant details" onClose={onClose} wide>
      {!d || !p ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-5 text-sm">
          <div><p className="font-display text-xl font-extrabold text-navy">{p.name ?? "(no name yet)"}</p><p className="text-ink-soft">{p.email}{p.phone ? ` · ${p.phone}` : ""}{p.institution ? ` · ${p.institution}` : ""} · created {tgl(p.createdAt)}{p.lastLoginAt ? ` · last sign-in ${tgl(p.lastLoginAt)}` : ""}</p>
            <p className="mt-1"><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span> {p.level && <span className="badge-ok ml-1">{p.level}{p.scoreEst ? ` · ${p.scoreEst}` : ""}</span>} {p.consentAt && <span className="ml-1 text-xs text-ink-soft">data consent {tgl(p.consentAt)}</span>}</p>
            {p.status === "invited" && <p className="mt-1 text-xs text-ink-soft">The participant activates the account by signing in and accepting the data consent. You can also activate it below with a reason (for example, consent collected on a paper form).</p>}</div>
          <ErrorNote text={err} />
          {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-success">{msg}</p>}

          <section><h3 className="font-semibold text-navy">Access & quota</h3>
            <p className="text-ink-soft">{d.enrollment ? `Enrollment ${d.enrollment.status} · ${d.enrollment.expiresAt ? `ends ${tgl(d.enrollment.expiresAt)}` : "no limit"}` : "No enrollment yet."}</p>
            {d.quotas.length > 0 && <ul className="mt-1">{d.quotas.map((q, i) => <li key={i}>Coaching {q.level}: {q.used}/{q.total}{q.active ? "" : " (inactive)"}</li>)}</ul>}
            <div className="mt-2 grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[100px_1fr_auto]"><input aria-label="Days" className="field" type="number" min={1} max={730} value={ext.days} onChange={(e) => setExt({ ...ext, days: Number(e.target.value) })} /><input aria-label="Extension reason" className="field" placeholder="Reason for extending access (required)" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} /><button className="btn-outline" disabled={ext.reason.trim().length < 3} onClick={() => run({ action: "extend_enrollment", ...ext }, "Access extended.").then(() => setExt({ days: 30, reason: "" }))}>Extend</button></div></section>

          <section><h3 className="font-semibold text-navy">Test history</h3>
            {d.attempts.length ? <ul className="mt-1">{d.attempts.map((a) => <li key={a.id} className="flex justify-between gap-3 border-b border-line py-1.5"><span>{a.kind} · {tgl(a.finishedAt)}{a.flags ? ` · ${a.flags} activity notes` : ""}{a.held ? " · held (not visible to participant)" : ""}</span><b>{a.scoreEst}</b></li>)}</ul> : <p className="text-ink-soft">None yet.</p>}
            {d.attempts.some((a) => a.held) && <button className="btn-outline mt-2 !min-h-[40px]" onClick={async () => { if (await askConfirm("Release this participant's held placement result now? They, their institution admin, and coaches will see it, and the result email is sent.", { confirmLabel: "Release result" })) run({ action: "release_results" }, "Result released."); }}>Release this result</button>}</section>

          <section><h3 className="font-semibold text-navy">Actions</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-outline !min-h-[40px]" onClick={() => setDlg("edit")}>Edit profile</button>
              <button className="btn-outline !min-h-[40px]" onClick={() => setDlg("reset")}>Reset password</button>
              <button className="btn-danger !min-h-[40px]" onClick={() => setDlg("delete")}>Delete account</button>
              {p.status === "invited" && <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "resend_invitation" }, "Invitation resent.")}>Resend invitation</button>}
              <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: p.qaTester ? "qa_off" : "qa_on" }, p.qaTester ? "QA tester access removed." : "QA tester access granted. This account can now see and run tests in Test mode.")}>{p.qaTester ? "Remove QA tester" : "Make QA tester"}</button>
              {p.status === "disabled" ? <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "enable" }, "Account activated.")}>Activate</button> : <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "disable" }, "Account deactivated.")}>Deactivate</button>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input aria-label="Reason" className="field" placeholder="Reason (required for the actions on the right)" value={reason} onChange={(e) => setReason(e.target.value)} />
              {p.status === "invited" && <button className="btn-outline" disabled={reason.trim().length < 3} onClick={() => run({ action: "activate", reason }, "Account activated. The reason is kept in the audit log as the basis of the data consent.")}>Activate now</button>}
              <button className="btn-outline" disabled={!p.placementDone || p.placementRetakeAllowed || reason.trim().length < 3} onClick={() => run({ action: "allow_placement_retake", reason }, "Placement may be retaken once.")}>Allow placement retake</button>
            </div>
          </section>

          <section><h3 className="font-semibold text-navy">Admin notes</h3>
            <ul className="mt-1">{d.notes.map((n, i) => <li key={i} className="border-b border-line py-1.5">{n.text}<span className="ml-2 text-xs text-ink-soft">{tgl(n.at, true)}</span></li>)}</ul>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input aria-label="Note" className="field" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-outline shrink-0" disabled={!note.trim()} onClick={() => run({ action: "note", text: note }).then(() => setNote(""))}>Save note</button></div></section>
        </div>
      )}
      {d && p && dlg === "edit" && <EditAccountDialog kind="participant" account={{ id, name: p.name ?? null, givenName: p.givenName, surname: p.surname, email: p.email, phone: p.phone }} onClose={() => setDlg(null)} onDone={(m) => { setDlg(null); setMsg(m); reload(); }} />}
      {d && p && dlg === "reset" && <ResetPasswordDialog kind="participant" account={{ id, name: p.name ?? null, email: p.email }} onClose={() => setDlg(null)} />}
      {d && p && dlg === "delete" && <DeleteAccountDialog kind="participant" account={{ id, name: p.name ?? null, email: p.email }} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onClose(); }} />}
    </Modal>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { toast } from "@/components/Feedback";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { id: string; number: number; name: string; email: string; category: string; team: "cs" | "tech"; status: string; urgent: boolean; preview: string; needsReply: boolean; updatedAt: string };
type List = { open: { cs: number; tech: number; new: number }; tickets: Row[] };
type Ctx = {
  id: string; name: string | null; email: string; role: string; phone: string | null; status: string; institution: string | null; placed: boolean;
  seats: { test: string; session: string; opensAt: string | null; closesAt: string | null; extended: boolean }[];
  attempts: { id: string; test: string; status: string; startedAt: string; finishedAt: string | null; lastSeen: string | null }[];
};
type Detail = Omit<Row, "preview" | "needsReply" | "updatedAt"> & { page: string | null; userAgent: string | null; createdAt: string; signedIn: boolean; messages: { from: "user" | "staff" | "system"; byName: string | null; body: string; at: string }[]; context: Ctx | null };

const STATUS: Record<string, [string, string]> = { new: ["New", "badge-warn"], in_progress: ["In progress", "badge-muted"], waiting: ["Waiting for user", "badge-muted"], resolved: ["Resolved", "badge-ok"] };
const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-");
const ago = (d: string) => { const m = Math.round((Date.now() - +new Date(d)) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };

/** Support (8.4): antrean CS dan Technical, percakapan, konteks pengirim, dan tindakan lewat profil peserta. */
export default function SupportDesk() {
  const [team, setTeam] = useState<"cs" | "tech">("cs");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [list, setList] = useState<List | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(() => api<List>(`/api/admin/support?team=${team}&status=${status}&q=${encodeURIComponent(q)}`, { silent: true }).then((d) => { setList(d); setErr(""); }).catch((e) => setErr((e as Error).message)), [team, status, q]);
  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setSel(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="page-title">Support</h1><p className="text-sm text-ink-soft">Requests from participants, institutions, and coaches. CS handles accounts, schedules, and general questions; Technical handles problems during the test and audio.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1 border-b border-line">
          {([["cs", "CS"], ["tech", "Technical"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={team === k} onClick={() => { setTeam(k); setSel(null); }} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${team === k ? "border-brand text-navy" : "border-transparent text-ink-soft"}`}>{l} <span className="text-ink-soft">{list?.open[k] ?? ""}</span></button>
          ))}
        </div>
        <select className="field !h-10 w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="open">All open</option><option value="new">New</option><option value="in_progress">In progress</option><option value="waiting">Waiting for user</option><option value="resolved">Resolved</option>
        </select>
        <input className="field !h-10 w-full sm:ml-auto sm:w-64" placeholder="Name, email, or ticket number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />
      </div>
      <ErrorNote text={err} />
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <ul className={`flex max-h-[75dvh] flex-col overflow-y-auto rounded-2xl border border-line bg-white ${sel ? "hidden lg:flex" : ""}`}>
          {!list && <li className="p-4"><Loading /></li>}
          {list?.tickets.map((t) => (
            <li key={t.id}>
              <button onClick={() => setSel(t.id)} className={`flex w-full flex-col gap-0.5 border-b border-line p-3 text-left text-sm hover:bg-brand-tint/40 ${sel === t.id ? "bg-brand-tint" : ""}`}>
                <span className="flex items-center gap-2"><b className="text-navy">#{t.number}</b>{t.urgent && <span className="badge-bad">Urgent</span>}{t.needsReply && t.status !== "resolved" && <span className="h-2 w-2 rounded-full bg-brand" aria-label="Needs reply" />}<span className="ml-auto text-xs text-ink-soft">{ago(t.updatedAt)}</span></span>
                <span className="truncate font-semibold text-ink">{t.name} · {t.category}</span>
                <span className="truncate text-xs text-ink-soft">{t.preview}</span>
              </button>
            </li>
          ))}
          {list && list.tickets.length === 0 && <li className="p-6 text-center text-sm text-ink-soft">No requests here.</li>}
        </ul>
        {sel ? <Ticket key={sel} id={sel} onBack={() => setSel(null)} onChanged={load} /> : <div className="hidden rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-ink-soft lg:block">Choose a request on the left.</div>}
      </div>
    </div>
  );
}

function Ticket({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Detail>(`/api/admin/support/${id}`, { silent: true }).then(setD).catch((e) => setErr((e as Error).message)), [id]);
  useEffect(() => { load(); }, [load]);
  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try { await api(`/api/admin/support/${id}`, { method: "PATCH", json: body, silent: true }); if (ok) toast(ok); await load(); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  }
  if (!d) return err ? <ErrorNote text={err} /> : <Loading />;
  const c = d.context;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <section className="card flex min-w-0 flex-col gap-3">
        <button className="self-start text-sm font-semibold text-brand lg:hidden" onClick={onBack}>← All requests</button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-xs font-semibold tracking-wider text-brand">#{d.number} · {d.team === "tech" ? "TECHNICAL" : "CS"}</p><h2 className="font-display text-xl font-extrabold text-navy">{d.category}</h2><p className="text-sm text-ink-soft">{d.name} · {d.email}{d.signedIn ? "" : " · not signed in"} · {when(d.createdAt)} WIB</p></div>
          <span className={STATUS[d.status][1]}>{STATUS[d.status][0]}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select className="field !h-9 w-auto" value={d.status} disabled={busy} onChange={(e) => patch({ status: e.target.value }, "Status updated")} aria-label="Status">
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn-outline !min-h-[36px]" disabled={busy} onClick={() => patch({ team: d.team === "cs" ? "tech" : "cs" }, "Moved")}>Move to {d.team === "cs" ? "Technical" : "CS"}</button>
          <button className="btn-outline !min-h-[36px]" disabled={busy} onClick={() => patch({ urgent: !d.urgent })}>{d.urgent ? "Remove urgent" : "Mark urgent"}</button>
        </div>
        <ol className="flex flex-col gap-2">
          {d.messages.map((m, i) => m.from === "system"
            ? <li key={i} className="text-center text-xs text-ink-soft">{m.body} · {when(m.at)}</li>
            : <li key={i} className={`max-w-[90%] rounded-2xl p-3 text-sm ${m.from === "staff" ? "self-end bg-brand-tint" : "self-start bg-canvas"}`}><p className="mb-1 text-xs font-semibold text-ink-soft">{m.from === "staff" ? `${m.byName ?? "Support"} (staff)` : m.byName} · {when(m.at)}</p><p className="whitespace-pre-line">{m.body}</p></li>)}
        </ol>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex gap-1 text-sm">{([["reply", "Reply to user"], ["note", "Internal note"]] as const).map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 font-semibold ${mode === k ? "bg-navy text-white" : "bg-canvas"}`}>{l}</button>)}</div>
          <textarea className={`field h-28 ${mode === "note" ? "bg-accent-tint" : ""}`} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "reply" ? "The user gets this by email and in the app." : "Only staff see this."} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-solid" disabled={busy || !text.trim()} onClick={() => patch(mode === "reply" ? { reply: text } : { note: text }, mode === "reply" ? "Reply sent" : "Note saved").then(() => setText(""))}>{mode === "reply" ? "Send reply" : "Save note"}</button>
            {mode === "reply" && <button className="btn-outline" disabled={busy || !text.trim()} onClick={() => patch({ reply: text, status: "resolved" }, "Reply sent and resolved").then(() => setText(""))}>Send & resolve</button>}
          </div>
        </div>
      </section>
      <aside className="card flex flex-col gap-3 text-sm">
        <h3 className="font-display font-extrabold text-navy">About the sender</h3>
        {!c ? <p className="text-ink-soft">No account found for this email.</p> : <>
          <p><b className="text-navy">{c.name ?? c.email}</b><br /><span className="text-ink-soft">{c.role === "inst_admin" ? "Institution" : c.role}{c.institution ? ` · ${c.institution}` : ""} · {c.status}</span>{c.phone && <><br /><span className="text-ink-soft">{c.phone}</span></>}</p>
          <div><p className="font-semibold text-navy">Test schedule</p>{c.seats.length ? <ul className="mt-1 flex flex-col gap-1">{c.seats.map((s, i) => <li key={i} className="text-xs"><b>{s.test}</b> · {s.session}<br /><span className="text-ink-soft">{when(s.opensAt)} – {when(s.closesAt)}{s.extended ? " · extended" : ""}</span></li>)}</ul> : <p className="text-xs text-ink-soft">No seat.</p>}</div>
          <div><p className="font-semibold text-navy">Recent tests</p>{c.attempts.length ? <ul className="mt-1 flex flex-col gap-1">{c.attempts.map((a) => <li key={a.id} className="text-xs"><b>{a.test}</b> · {a.status === "submitted" ? "finished" : "in progress"}<br /><span className="text-ink-soft">started {when(a.startedAt)}{a.status !== "submitted" && a.lastSeen ? ` · last signal ${ago(a.lastSeen)} ago` : ""}</span>{a.status !== "submitted" && <> · <Link className="font-semibold text-brand" href={`/admin/proctoring/${a.id}`}>Trace</Link></>}</li>)}</ul> : <p className="text-xs text-ink-soft">No attempts.</p>}</div>
          {c.role === "participant" && <Link className="btn-solid" href={`/admin/participants/${c.id}#admin-actions`}>Reschedule, extend, reset…</Link>}
        </>}
        {(d.page || d.userAgent) && <p className="border-t border-line pt-2 text-xs text-ink-soft">{d.page && <>Sent from {d.page}<br /></>}{d.userAgent}</p>}
      </aside>
    </div>
  );
}

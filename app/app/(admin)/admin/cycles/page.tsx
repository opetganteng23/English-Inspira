"use client";

import { askConfirm } from "@/components/Feedback";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Cycle = {
  id: string; institutionId: string; institution: string; name: string; startsAt: string; endsAt: string; durationSource: string; closedAt: string | null;
  status: "scheduled" | "active" | "closed"; itpDate: string | null; itpRequired: boolean; counts: { placed: number; quotas: number; attempts: number; bookings: number };
};
type Data = { cycles: Cycle[]; institutions: { id: string; name: string }[] };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const BADGE = { scheduled: "badge-muted", active: "badge-ok", closed: "badge-warn" } as const;
// Tanggal dipahami sebagai hari kalender WIB.
const ymd = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) : "");
const show = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

export default function Cycles() {
  const { data, loading, error, reload } = useApi<Data>("/api/admin/cycles");
  const [edit, setEdit] = useState<Partial<Cycle> | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>, ok = "") => { setErr(""); setMsg(""); try { await fn(); setMsg(ok); reload(); } catch (e) { setErr((e as Error).message); } };

  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Program Cycles</h1><p className="max-w-3xl text-sm text-ink-soft">A program cycle is the official learning period of an institution, set from its contract or academic calendar. Each new cycle requires a new placement test, resets the coaching quota, and a closed cycle stops graded activities while course materials stay readable. Institutions without a cycle keep working without period limits.</p></div>
        <button className="btn-solid" disabled={!data?.institutions.length} onClick={() => setEdit({ itpRequired: false })}>+ New cycle</button>
      </div>
      <ErrorNote text={error || err} />
      {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      {data?.cycles.length === 0 && <p className="card text-sm text-ink-soft">No program cycles yet. Click “+ New cycle” to set a program period for an institution.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {data?.cycles.map((c) => (
          <li key={c.id} className="card flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><b className="text-navy">{c.name}</b><p className="text-sm text-ink-soft">{c.institution}</p></div>
              <span className={BADGE[c.status]}>{c.status === "scheduled" ? "Scheduled" : c.status === "active" ? "Active" : "Closed"}</span>
            </div>
            <p className="text-sm text-ink">{show(c.startsAt)} to {show(c.endsAt)}{c.closedAt ? ` (closed ${show(c.closedAt)})` : ""}</p>
            {c.durationSource && <p className="text-xs text-ink-soft">Source: {c.durationSource}</p>}
            {(c.itpDate || c.itpRequired) && <p className="text-xs text-ink-soft">Official EPTA test: {show(c.itpDate)}{c.itpRequired ? " (required)" : " (optional)"}</p>}
            <p className="text-xs text-ink-soft">{c.counts.placed} placements · {c.counts.quotas} quotas · {c.counts.attempts} attempts · {c.counts.bookings} bookings</p>
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm font-semibold">
              <button className="text-brand" onClick={() => setEdit(c)}>Edit</button>
              {c.status !== "closed" && <button className="text-brand" onClick={() => void askConfirm("Close this period now? Participants can no longer take tests or book coaching for it.").then((ok) => { if (ok) run(() => api(`/api/admin/cycles/${c.id}`, { json: { action: "close" } }), "Period closed"); })}>Close now</button>}
              {c.status === "closed" && c.closedAt && <button className="text-brand" onClick={() => run(() => api(`/api/admin/cycles/${c.id}`, { json: { action: "reopen" } }), "Period reopened")}>Reopen</button>}
              <button className="text-red-700" onClick={() => void askConfirm("Delete this period?").then((ok) => { if (ok) run(() => api(`/api/admin/cycles/${c.id}`, { method: "DELETE" }), "Period deleted"); })}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {edit && data && <CycleEditor init={edit} institutions={data.institutions} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function CycleEditor({ init, institutions, onClose, onSaved }: { init: Partial<Cycle>; institutions: Data["institutions"]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ institutionId: init.institutionId ?? institutions[0]?.id ?? "", name: init.name ?? "", startsAt: ymd(init.startsAt ?? null), endsAt: ymd(init.endsAt ?? null), durationSource: init.durationSource ?? "", itpDate: ymd(init.itpDate ?? null), itpRequired: init.itpRequired ?? false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try {
      await api(init.id ? `/api/admin/cycles/${init.id}` : "/api/admin/cycles", {
        method: init.id ? "PATCH" : "POST",
        json: { institutionId: v.institutionId, name: v.name, startsAt: `${v.startsAt}T00:00:00+07:00`, endsAt: `${v.endsAt}T23:59:59+07:00`, durationSource: v.durationSource || undefined, itpDate: v.itpDate ? `${v.itpDate}T00:00:00+07:00` : null, itpRequired: v.itpRequired },
      });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title={init.id ? "Edit program cycle" : "New program cycle"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Institution<select className="field font-normal" disabled={!!init.id} value={v.institutionId} onChange={(e) => setV({ ...v, institutionId: e.target.value })}>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <label className={label}>Name<input className="field font-normal" placeholder="Example: Semester 1 2026" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Starts<input className="field font-normal" type="date" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} /></label>
          <label className={label}>Ends<input className="field font-normal" type="date" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></label>
        </div>
        <label className={label}>Basis of the dates<input className="field font-normal" placeholder="Contract or academic calendar" value={v.durationSource} onChange={(e) => setV({ ...v, durationSource: e.target.value })} /></label>
        <label className={label}>Official EPTA test date (optional)<input className="field font-normal" type="date" value={v.itpDate} onChange={(e) => setV({ ...v, itpDate: e.target.value })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.itpRequired} onChange={(e) => setV({ ...v, itpRequired: e.target.checked })} />Official EPTA test is required for this institution in this period</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !v.name.trim() || !v.startsAt || !v.endsAt} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </Modal>
  );
}

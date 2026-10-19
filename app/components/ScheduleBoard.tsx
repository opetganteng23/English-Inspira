"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { askConfirm } from "@/components/Feedback";

type Seat = { userId: string; name: string | null; email: string; institution: string | null; invited: boolean; extended: boolean; opensAt: string; closesAt: string; status: "done" | "running" | null };
type Sess = { id: string; label: string; opensAt: string; closesAt: string; capacity: number; pending?: number; seats: Seat[] };
type Person = { id: string; name: string | null; email: string; institutionId: string | null; institution: string | null };
type Board = { test: { id: string; name: string; scheduled: boolean; reminderMode?: "all" | "closing" | "none" }; institutions: { id: string; name: string }[]; pending: { invite: number; reschedule: number; skipped: number }; sessions: Sess[]; pool: Person[] };
type Chip = { id: string; name: string | null; email: string; institution: string | null; seat?: Seat };

const wib = (d: string) => new Date(d).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const toInput = (d: string | Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const POOL_LIMIT = 300;

/**
 * Papan jadwal tes (kartu per sesi). Admin: kelola penuh. Portal institusi (`readOnly`): tampilan sama persis,
 * hanya peserta institusinya, tanpa aksi apa pun.
 */
export function ScheduleBoard({ testId, readOnly = false, apiUrl, back }: { testId: string; readOnly?: boolean; apiUrl?: string; back?: { href: string; label: string } }) {
  const params = { id: testId };
  const { data, error, loading, reload } = useApi<Board>(apiUrl ?? `/api/admin/tests/${testId}/schedule`);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [inst, setInst] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [form, setForm] = useState<{ id?: string; label: string; opensAt: string; closesAt: string; capacity: number } | null>(null);
  const [ext, setExt] = useState<{ userId: string; name: string; opensAt: string; closesAt: string; reason: string } | null>(null);
  const [spreadForm, setSpreadForm] = useState({ mode: "random", institutionId: "", count: "" });
  const [undo, setUndo] = useState<{ userId: string; from: string | null }[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [note, setNote] = useState("");
  const [find, setFind] = useState("");
  const base = `/api/admin/tests/${params.id}/schedule`;

  const where = useMemo(() => { const m = new Map<string, string | null>(); data?.sessions.forEach((s) => s.seats.forEach((x) => m.set(x.userId, s.id))); return m; }, [data]);
  const pool = useMemo(() => {
    const rx = q.trim().toLowerCase();
    return (data?.pool ?? []).filter((p) => (!inst || p.institutionId === inst) && (!rx || `${p.name ?? ""} ${p.email}`.toLowerCase().includes(rx)));
  }, [data, q, inst]);

  async function run(fn: () => Promise<unknown>, okNote = "") {
    setErr(""); setNote(""); setBusy(true);
    try { await fn(); if (okNote) setNote(okNote); await reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  function move(userIds: string[], sessionId: string | null) {
    if (!userIds.length) return;
    const before = userIds.map((u) => ({ userId: u, from: where.get(u) ?? null }));
    return run(async () => {
      const r = await api<{ moved: number; blocked: number }>(`${base}/move`, { json: { userIds, sessionId }, silent: true });
      setUndo(before); setPicked(new Set());
      if (r.blocked) setNote(`${r.blocked} could not be moved: they already started or finished this test.`);
    });
  }
  async function undoMove() {
    if (!undo) return;
    const groups = new Map<string | null, string[]>();
    for (const u of undo) (groups.get(u.from) ?? groups.set(u.from, []).get(u.from)!).push(u.userId);
    await run(async () => { for (const [sid, ids] of groups) await api(`${base}/move`, { json: { userIds: ids, sessionId: sid }, silent: true }); setUndo(null); });
  }
  function dropOn(sessionId: string | null, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    move(picked.has(id) ? [...picked] : [id], sessionId);
  }
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function renderChip(c: Chip) {
    const locked = !!c.seat?.status;
    return (
      <li key={c.id} draggable={!locked && !readOnly} onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${picked.has(c.id) ? "border-brand bg-brand-tint" : "border-line bg-white"} ${locked ? "opacity-70" : readOnly ? "" : "cursor-grab"}`}>
        {!readOnly && <input type="checkbox" aria-label={`Select ${c.name ?? c.email}`} checked={picked.has(c.id)} disabled={locked} onChange={() => toggle(c.id)} />}
        <span className="min-w-0 flex-1"><b className="block truncate text-navy">{c.name ?? c.email}</b><span className="block truncate text-ink-soft">{c.institution ?? c.email}</span></span>
        {c.seat?.status === "done" && <span className="badge-muted">done</span>}
        {c.seat?.status === "running" && <span className="badge-warn">running</span>}
        {c.seat?.extended && <span className="badge-warn" title="Has a personal schedule">custom</span>}
        {c.seat?.invited && <span title="Invitation sent" className="text-success">✉</span>}
        {!readOnly && c.seat && !c.seat.status && <button className="font-semibold text-brand" onClick={() => setExt({ userId: c.id, name: c.name ?? c.email, opensAt: toInput(c.seat!.opensAt), closesAt: toInput(c.seat!.closesAt), reason: "" })}>Reschedule</button>}
      </li>
    );
  }

  // Cari orang di semua kartu sesi sekaligus.
  const rxFind = find.trim().toLowerCase();
  const hit = (x: { name: string | null; email: string }) => !rxFind || `${x.name ?? ""} ${x.email}`.toLowerCase().includes(rxFind);
  const found = rxFind && data ? data.sessions.flatMap((s) => s.seats.filter(hit).map((x) => ({ ...x, session: s }))) : [];

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote text={error} />;
  const sch = data.test.scheduled;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={back?.href ?? "/admin/tests"} className="text-sm font-semibold text-brand">{back?.label ?? "← Tests"}</Link>
          <h1 className="font-display text-3xl font-extrabold text-navy">Schedule: {data.test.name}</h1>
          <p className="text-sm text-ink-soft">{readOnly ? "Your participants per session. Times are in WIB. To move someone to another session, contact the program admin." : "Create sessions, spread participants automatically, then drag people between cards. Times are in WIB."}</p>
          {!readOnly && <a href={`/api/admin/tests/${params.id}/export.xlsx`} className="mt-2 inline-block text-sm font-semibold text-brand">Export results, all sessions (Excel)</a>}
        </div>
        {readOnly && <p className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy"><b>{data.sessions.reduce((n, s) => n + s.seats.length, 0)}</b> participants · <b>{data.sessions.reduce((n, s) => n + s.seats.filter((x) => x.status === "done").length, 0)}</b> done · <b>{data.sessions.reduce((n, s) => n + s.seats.filter((x) => x.invited).length, 0)}</b> invited ✉</p>}
        {!readOnly && <><label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-navy">
          <input type="checkbox" checked={sch} disabled={busy} onChange={(e) => run(() => api(base, { method: "PATCH", json: { scheduled: e.target.checked } }))} />
          Scheduling {sch ? "on: only people on a card can open this test" : "off: everyone eligible can open it"}
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">Automatic reminders
          <select className="field" value={data.test.reminderMode ?? "all"} disabled={busy} onChange={(e) => run(() => api(base, { method: "PATCH", json: { reminderMode: e.target.value } }))}>
            <option value="all">All: a day before, when it opens, and before it closes</option>
            <option value="closing">Only before it closes, to people who have not started</option>
            <option value="none">None</option>
          </select>
        </label></>}
      </div>
      <ErrorNote text={err || error} />
      {!readOnly && data.pending.skipped > 0 && <p role="note" className="rounded-lg bg-accent-tint p-3 text-sm text-navy"><b>Test mode safety.</b> This test is still in Test mode, so invitation emails go only to QA tester accounts. {data.pending.skipped} other {data.pending.skipped === 1 ? "person on a card will" : "people on cards will"} not be emailed until Test mode is turned off.</p>}
      {note && <p role="status" className="rounded-lg bg-brand-tint p-3 text-sm text-navy">{note}</p>}

      {!readOnly && <section className="card flex flex-wrap items-end gap-3">
        <div><label className="text-xs font-semibold text-ink-soft">Spread rule</label>
          <select className="field" value={spreadForm.mode} onChange={(e) => setSpreadForm({ ...spreadForm, mode: e.target.value })}>
            <option value="random">Random, evenly</option><option value="balanced">Balanced per institution</option><option value="sequential">Fill in order</option>
          </select></div>
        <div><label className="text-xs font-semibold text-ink-soft">Institution (optional)</label>
          <select className="field" value={spreadForm.institutionId} onChange={(e) => setSpreadForm({ ...spreadForm, institutionId: e.target.value })}>
            <option value="">All</option>{data.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-ink-soft">Take a random sample of</label>
          <input className="field w-28" inputMode="numeric" placeholder="everyone" value={spreadForm.count} onChange={(e) => setSpreadForm({ ...spreadForm, count: e.target.value.replace(/\D/g, "") })} /></div>
        <button className="btn-solid" disabled={busy || !data.sessions.length}
          onClick={() => run(async () => {
            const r = await api<{ placed: number; left: number }>(`${base}/spread`, { json: { mode: spreadForm.mode, institutionId: spreadForm.institutionId || undefined, count: spreadForm.count ? Number(spreadForm.count) : undefined }, silent: true });
            setNote(`${r.placed} people placed${r.left ? `, ${r.left} did not fit (sessions are full)` : ""}. Drag people between cards to adjust.`);
          })}>Spread automatically</button>
        <button className="btn-outline" onClick={() => setForm({ label: `Session ${data.sessions.length + 1}`, opensAt: "", closesAt: "", capacity: 100 })}>+ Add session</button>
        {undo && <button className="btn-outline" onClick={undoMove} disabled={busy}>Undo last move</button>}
        <button className="btn-solid ml-auto" disabled={busy || (!data.pending.invite && !data.pending.reschedule)}
          onClick={async () => { if (await askConfirm(`Send ${data.pending.invite} invitation${data.pending.invite === 1 ? "" : "s"}${data.pending.reschedule ? ` and ${data.pending.reschedule} new-schedule email${data.pending.reschedule === 1 ? "" : "s"}` : ""}? Emails go out gradually through the mail queue.`, { confirmLabel: "Send" })) run(async () => { const r = await api<{ invited: number; rescheduled: number; skipped: number }>(`${base}/send`, { json: {}, silent: true }); setNote(`Queued ${r.invited} invitation(s) and ${r.rescheduled} schedule change email(s).${r.skipped ? ` ${r.skipped} people were skipped because this test is still in Test mode: only QA tester accounts get emails.` : ""}`); }); }}>
          Send invites ({data.pending.invite + data.pending.reschedule})
        </button>
      </section>}

      {!readOnly && picked.size > 0 && (
        <section className="card flex flex-wrap items-center gap-3" aria-label="Selection">
          <b className="text-navy">{picked.size} selected</b>
          <select className="field" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move selected to">
            <option value="">Move to…</option>{data.sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}<option value="__pool">No session (remove)</option>
          </select>
          <button className="btn-solid" disabled={!moveTo || busy} onClick={() => move([...picked], moveTo === "__pool" ? null : moveTo)}>Move</button>
          <button className="btn-outline" onClick={() => setPicked(new Set())}>Clear</button>
        </section>
      )}

      <section className="card flex flex-col gap-3" aria-label="Find a participant">
        <div className="flex flex-wrap items-center gap-2">
          <input className="field min-w-[260px] flex-1 sm:max-w-md" type="search" placeholder="Find a participant in all sessions (name or email)" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a participant" />
          {rxFind && <span className="text-sm text-ink-soft">{found.length} found{found.length > 0 && " · cards below show only matches"}</span>}
          {rxFind && <button className="text-sm font-semibold text-brand" onClick={() => setFind("")}>Clear</button>}
        </div>
        {rxFind && found.length > 0 && found.length <= 30 && (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {found.map((x) => (
              <li key={x.userId} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1"><b className="text-navy">{x.name ?? x.email}</b><span className="block text-xs text-ink-soft">{x.email}</span></span>
                <span className="text-xs text-ink-soft">in <b className="text-navy">{x.session.label}</b>{x.status === "done" ? " · done" : x.status === "running" ? " · running" : ""}</span>
                {!readOnly && !x.status && (
                  <select className="field !h-9 w-auto text-sm" aria-label={`Move ${x.name ?? x.email} to`} value="" disabled={busy}
                    onChange={(e) => { const to = e.target.value; if (to) move([x.userId], to === "__pool" ? null : to); }}>
                    <option value="">Move to…</option>
                    {data.sessions.filter((s) => s.id !== x.session.id).map((s) => <option key={s.id} value={s.id}>{s.label} ({s.capacity - s.seats.length} free)</option>)}
                    <option value="__pool">No session (remove)</option>
                  </select>
                )}
                {!readOnly && !x.status && <button className="text-xs font-semibold text-brand" onClick={() => setExt({ userId: x.userId, name: x.name ?? x.email, opensAt: toInput(x.opensAt), closesAt: toInput(x.closesAt), reason: "" })}>Reschedule</button>}
              </li>
            ))}
          </ul>
        )}
        {rxFind && found.length === 0 && <p className="text-sm text-ink-soft">Nobody in the sessions matches “{find}”.{!readOnly && " They may be in “No session yet”."}</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.sessions.map((s) => {
          const pct = Math.min(100, Math.round((s.seats.length / s.capacity) * 100));
          return (
            <section key={s.id} className="card flex flex-col gap-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => !readOnly && dropOn(s.id, e)} aria-label={s.label}>
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-display text-lg font-extrabold text-navy">{s.label}</h2><p className="text-xs text-ink-soft">{wib(s.opensAt)} to {wib(s.closesAt)}</p></div>
                {!readOnly && <div className="flex gap-2 text-xs font-semibold">{(s.pending ?? 0) > 0 && <button className="text-brand" disabled={busy} onClick={async () => { if (await askConfirm(`Send ${s.pending} email${s.pending === 1 ? "" : "s"} for ${s.label} only?`, { title: "Send invites for this session", confirmLabel: "Send", danger: false })) run(async () => { const r = await api<{ invited: number; rescheduled: number; skipped: number }>(`${base}/send`, { json: { sessionId: s.id }, silent: true }); setNote(`${s.label}: ${r.invited} invitations and ${r.rescheduled} new-schedule emails queued${r.skipped ? `, ${r.skipped} skipped (Test mode)` : ""}. Emails go out within the daily limit.`); }); }}>Send invites ({s.pending})</button>}<a className="text-brand" href={`/api/admin/tests/${params.id}/export.xlsx?session=${s.id}`} title={`Export ${s.label} (Excel)`}>Export</a><button className="text-brand" onClick={() => setForm({ id: s.id, label: s.label, opensAt: toInput(s.opensAt), closesAt: toInput(s.closesAt), capacity: s.capacity })}>Edit</button>
                  <button className="text-red-700" onClick={async () => { if (await askConfirm(`Delete "${s.label}"? Its people go back to the unassigned list.`, { danger: true })) run(() => api(`${base}/sessions/${s.id}`, { method: "DELETE" })); }}>Delete</button></div>}
              </div>
              <div><p className="flex justify-between text-xs"><span className="font-semibold text-navy">{s.seats.length} / {s.capacity}</span><span className="text-ink-soft">{s.capacity - s.seats.length} free</span></p>
                <div className="h-2 rounded-full bg-canvas"><div className={`h-2 rounded-full ${pct >= 100 ? "bg-accent" : "bg-brand"}`} style={{ width: `${pct}%` }} /></div></div>
              <ul className="flex max-h-[420px] min-h-[64px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-dashed border-line p-1.5">
                {s.seats.length === 0 && <li className="p-3 text-center text-xs text-ink-soft">{readOnly ? "Nobody from your institution" : "Drop people here"}</li>}
                {rxFind && s.seats.length > 0 && !s.seats.some(hit) && <li className="p-3 text-center text-xs text-ink-soft">No match in this session</li>}
                {s.seats.filter(hit).map((x) => renderChip({ id: x.userId, name: x.name, email: x.email, institution: x.institution, seat: x }))}
              </ul>
            </section>
          );
        })}

        {!readOnly && <section className="card flex flex-col gap-2 bg-canvas" onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOn(null, e)} aria-label="Unassigned">
          <h2 className="font-display text-lg font-extrabold text-navy">No session yet <span className="text-sm font-semibold text-ink-soft">({pool.length}{pool.length !== data.pool.length ? ` of ${data.pool.length}` : ""})</span></h2>
          <p className="text-xs text-ink-soft">People here receive no invitation and cannot open this test while scheduling is on.</p>
          <div className="flex flex-col gap-2"><input className="field w-full" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field w-full" value={inst} onChange={(e) => setInst(e.target.value)} aria-label="Institution"><option value="">All</option>{data.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
          {pool.length > 0 && <button className="text-left text-xs font-semibold text-brand" onClick={() => setPicked(new Set([...picked, ...pool.slice(0, showAll ? undefined : POOL_LIMIT).map((p) => p.id)]))}>Select all shown</button>}
          <ul className="flex max-h-[420px] min-h-[64px] flex-col gap-1.5 overflow-y-auto p-1">
            {pool.slice(0, showAll ? undefined : POOL_LIMIT).map((p) => renderChip({ id: p.id, name: p.name, email: p.email, institution: p.institution }))}
            {pool.length === 0 && <li className="p-3 text-center text-xs text-ink-soft">Nobody left</li>}
          </ul>
          {!showAll && pool.length > POOL_LIMIT && <button className="text-xs font-semibold text-brand" onClick={() => setShowAll(true)}>Show all {pool.length}</button>}
        </section>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/50 p-4" role="dialog" aria-modal="true" aria-label="Session">
          <div className="card w-full max-w-md">
            <h2 className="font-display text-xl font-extrabold text-navy">{form.id ? "Edit session" : "New session"}</h2>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              <label>Name<input className="field w-full" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
              <label>Opens<input type="datetime-local" className="field w-full" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></label>
              <label>Closes<input type="datetime-local" className="field w-full" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></label>
              <label>Capacity<input inputMode="numeric" className="field w-full" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value.replace(/\D/g, "")) })} /></label>
              <p className="text-xs text-ink-soft">People can start any time between opening and closing. A test that has started may finish after closing, within its own timer.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn-solid" disabled={busy || !form.opensAt || !form.closesAt} onClick={() => run(async () => {
                const body = { label: form.label, opensAt: new Date(form.opensAt).toISOString(), closesAt: new Date(form.closesAt).toISOString(), capacity: form.capacity };
                await api(form.id ? `${base}/sessions/${form.id}` : `${base}/sessions`, { method: form.id ? "PATCH" : "POST", json: body }); setForm(null);
              })}>Save</button>
            </div>
          </div>
        </div>
      )}

      {ext && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/50 p-4" role="dialog" aria-modal="true" aria-label="Reschedule participant">
          <div className="card w-full max-w-md">
            <h2 className="font-display text-xl font-extrabold text-navy">Reschedule {ext.name}</h2>
            <p className="text-sm text-ink-soft">Only this person gets a new window. They receive an email with the new times.</p>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              <label>Opens<input type="datetime-local" className="field w-full" value={ext.opensAt} onChange={(e) => setExt({ ...ext, opensAt: e.target.value })} /></label>
              <label>Closes<input type="datetime-local" className="field w-full" value={ext.closesAt} onChange={(e) => setExt({ ...ext, closesAt: e.target.value })} /></label>
              <label>Reason (kept in the audit log, shown in the email)<input className="field w-full" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setExt(null)}>Cancel</button>
              <button className="btn-solid" disabled={busy || ext.reason.trim().length < 3 || !ext.opensAt || !ext.closesAt} onClick={() => run(async () => {
                await api(`${base}/extend`, { json: { userId: ext.userId, opensAt: new Date(ext.opensAt).toISOString(), closesAt: new Date(ext.closesAt).toISOString(), reason: ext.reason } }); setExt(null);
              })}>Save and notify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

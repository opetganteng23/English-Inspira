"use client";

import { askConfirm } from "@/components/Feedback";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Cls = { id: string; name: string; levelId: string; capacity: number; isActive: boolean; institutionId: string | null; institution: string | null; programCycleId: string | null; cycle: string | null; coachId: string | null; coach: string | null; students: number; active: number; avgScore: number | null };
type Data = { levels: { id: string; name: string; scoreMin: number; scoreMax: number; waiting: number }[]; institutions: { id: string; name: string }[]; cycles: { id: string; name: string; institution: string; status: string }[]; coaches: { id: string; name: string }[]; classes: Cls[] };
type Member = { userId: string; name: string; email: string; score: number | null; source: string | null; method: string; joinedAt: string; lastLoginAt: string | null; active: boolean };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Classes() {
  const { data, loading, error, reload } = useApi<Data>("/api/admin/classes");
  const [edit, setEdit] = useState<Partial<Cls> | null>(null);
  const [open, setOpen] = useState<Cls | null>(null);
  const [waitLevel, setWaitLevel] = useState<string | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok = "") => { setErr(""); setMsg(""); setBusy(true); try { const r = await fn(); setMsg(typeof r === "string" ? r : ok); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const waitingTotal = data?.levels.reduce((n, l) => n + l.waiting, 0) ?? 0;

  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Classes</h1><p className="max-w-3xl text-sm text-ink-soft">Participants are grouped by level from their score (EPTA scale), then placed at random in a class of that level that still has seats, starting with the emptiest class so classes stay balanced. Active means signed in or studied in the last 7 days.</p></div>
        <div className="flex flex-wrap gap-2">
          {waitingTotal > 0 && <button className="btn-outline" disabled={busy} onClick={() => run(async () => { const r = await api<{ assigned: number; stillWaiting: number }>("/api/admin/classes/assign", { json: { action: "auto" } }); return `${r.assigned} placed in classes.${r.stillWaiting ? ` ${r.stillWaiting} still waiting: add classes or seats for their level.` : ""}`; })}>Place {waitingTotal} waiting</button>}
          <button className="btn-solid" onClick={() => setEdit({ capacity: 25, isActive: true, levelId: data?.levels[0]?.id })}>+ New class</button>
        </div>
      </div>
      <ErrorNote text={error || err} />
      {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      {data?.levels.map((l) => {
        const cs = data.classes.filter((c) => c.levelId === l.id);
        const seats = cs.filter((c) => c.isActive).reduce((n, c) => n + c.capacity, 0), filled = cs.filter((c) => c.isActive).reduce((n, c) => n + c.students, 0);
        return (
          <section key={l.id} className="flex flex-col gap-3" aria-label={`${l.name} classes`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold text-navy">{l.name} <span className="text-sm font-semibold text-ink-soft">{l.scoreMin} to {l.scoreMax}</span></h2>
              <p className="text-sm text-ink-soft">{filled}/{seats} seats filled{l.waiting > 0 && <> · <button className="font-semibold text-accent-dark underline" onClick={() => setWaitLevel(l.id)}>{l.waiting} waiting for a class</button></>}</p>
            </div>
            {cs.length === 0 && <p className="card text-sm text-ink-soft">No classes for this level yet.</p>}
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cs.map((c) => {
                const pct = Math.min(100, Math.round((c.students / c.capacity) * 100));
                return (
                  <li key={c.id} className={`card flex flex-col gap-2 ${c.isActive ? "" : "opacity-70"}`}>
                    <div className="flex items-start justify-between gap-2"><div><b className="text-navy">{c.name}</b>{!c.isActive && <span className="badge-muted ml-2">inactive</span>}<p className="text-xs text-ink-soft">{c.coach ? `Coach: ${c.coach}` : "No coach yet"}{c.institution ? ` · ${c.institution}` : ""}{c.cycle ? ` · ${c.cycle}` : ""}</p></div><span className={c.students >= c.capacity ? "badge-warn" : "badge-ok"}>{c.students >= c.capacity ? "Full" : `${c.capacity - c.students} seats left`}</span></div>
                    <div className="h-2 rounded-full bg-canvas" role="progressbar" aria-valuenow={c.students} aria-valuemax={c.capacity} aria-label={`${c.name} seats`}><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                    <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-canvas p-2"><dt className="text-[11px] uppercase text-ink-soft">Students</dt><dd className="font-bold text-navy">{c.students}/{c.capacity}</dd></div>
                      <div className="rounded-lg bg-canvas p-2"><dt className="text-[11px] uppercase text-ink-soft">Active</dt><dd className="font-bold text-success">{c.active}</dd></div>
                      <div className="rounded-lg bg-canvas p-2"><dt className="text-[11px] uppercase text-ink-soft">Avg score</dt><dd className="font-bold text-navy">{c.avgScore ?? "-"}</dd></div>
                    </dl>
                    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold"><button className="text-brand" onClick={() => setOpen(c)}>Students</button><button className="text-brand" onClick={() => setEdit(c)}>Edit</button><button className="text-red-700" onClick={() => void askConfirm(`Delete ${c.name}?`).then((ok) => { if (ok) run(async () => { const r = await api<{ deactivated?: boolean }>(`/api/admin/classes/${c.id}`, { method: "DELETE" }); return r.deactivated ? `${c.name} has history, so it was deactivated instead.` : `${c.name} deleted.`; }); })}>Delete</button></div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {edit && data && <ClassEditor init={edit} data={data} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {open && data && <MembersDialog cls={open} classes={data.classes.filter((c) => c.levelId === open.levelId && c.isActive)} onClose={() => { setOpen(null); reload(); }} />}
      {waitLevel && data && <WaitingDialog levelId={waitLevel} classes={data.classes.filter((c) => c.levelId === waitLevel && c.isActive)} onClose={() => { setWaitLevel(null); reload(); }} />}
    </div>
  );
}

function ClassEditor({ init, data, onClose, onSaved }: { init: Partial<Cls>; data: Data; onClose: () => void; onSaved: () => void }) {
  const lv = data.levels.find((l) => l.id === init.levelId);
  const [v, setV] = useState({ name: init.name ?? (lv ? `${lv.name} ${String.fromCharCode(65 + data.classes.filter((c) => c.levelId === lv.id).length)}` : ""), levelId: init.levelId ?? "", capacity: init.capacity ?? 25, coachId: init.coachId ?? "", institutionId: init.institutionId ?? "", programCycleId: init.programCycleId ?? "", active: init.isActive ?? true });
  const [err, setErr] = useState("");
  async function save() {
    try { await api(init.id ? `/api/admin/classes/${init.id}` : "/api/admin/classes", { method: init.id ? "PATCH" : "POST", json: { ...v, capacity: Number(v.capacity), coachId: v.coachId || null, institutionId: v.institutionId || null, programCycleId: v.programCycleId || null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={init.id ? "Edit class" : "New class"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Level<select className="field font-normal" value={v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })}>{data.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className={label}>Class name<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className={label}>Seats<input className="field font-normal" type="number" min={1} max={500} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} /></label>
          <label className={label}>Coach<select className="field font-normal" value={v.coachId} onChange={(e) => setV({ ...v, coachId: e.target.value })}><option value="">No coach yet</option>{data.coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className={label}>Institution<select className="field font-normal" value={v.institutionId} onChange={(e) => setV({ ...v, institutionId: e.target.value })}><option value="">All institutions</option>{data.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <label className={label}>Program cycle<select className="field font-normal" value={v.programCycleId} onChange={(e) => setV({ ...v, programCycleId: e.target.value })}><option value="">Any period</option>{data.cycles.map((c) => <option key={c.id} value={c.id}>{c.institution}: {c.name} ({c.status})</option>)}</select></label>
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active (receives new students)</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!v.name.trim() || !v.levelId} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function MembersDialog({ cls, classes, onClose }: { cls: Cls; classes: Cls[]; onClose: () => void }) {
  const { data, loading, error, reload } = useApi<{ members: Member[] }>(`/api/admin/classes/${cls.id}`);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const move = async (userId: string, classId: string | null) => { setErr(""); try { await api("/api/admin/classes/assign", { json: { userId, classId } }); reload(); } catch (e) { setErr((e as Error).message); } };
  const list = (data?.members ?? []).filter((m) => filter === "all" || (filter === "active" ? m.active : !m.active));
  return (
    <Modal title={`${cls.name}: students`} onClose={onClose} wide>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2" role="tablist">{(["all", "active", "inactive"] as const).map((f) => <button key={f} role="tab" aria-selected={filter === f} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-navy text-white" : "bg-canvas text-navy"}`} onClick={() => setFilter(f)}>{f === "all" ? `All (${data?.members.length ?? 0})` : f === "active" ? `Active (${data?.members.filter((m) => m.active).length ?? 0})` : `Not active (${data?.members.filter((m) => !m.active).length ?? 0})`}</button>)}</div>
        <ErrorNote text={error || err} />
        {loading && !data ? <Loading /> : list.length === 0 ? <p className="text-ink-soft">No students here.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th>Score</th><th>Status</th><th>Joined</th><th>Move to</th></tr></thead>
            <tbody>{list.map((m) => (
              <tr key={m.userId}>
                <td><b className="text-navy">{m.name}</b><br /><span className="text-xs text-ink-soft">{m.email}</span></td>
                <td>{m.score ?? "-"}{m.source && m.source !== "test" ? <span className="block text-xs text-ink-soft">Class test</span> : null}</td>
                <td><span className={m.active ? "badge-ok" : "badge-muted"}>{m.active ? "Active" : "Not active"}</span><span className="block text-xs text-ink-soft">{m.lastLoginAt ? `Last sign in ${tgl(m.lastLoginAt)}` : "Never signed in"}</span></td>
                <td className="whitespace-nowrap">{tgl(m.joinedAt)}<span className="block text-xs text-ink-soft">{m.method === "auto" ? "Placed automatically" : "Moved by admin"}</span></td>
                <td><select className="field min-h-[38px] py-1" aria-label={`Move ${m.name}`} value={cls.id} onChange={(e) => move(m.userId, e.target.value === "__none" ? null : e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.id !== cls.id ? ` (${c.capacity - c.students} left)` : ""}</option>)}<option value="__none">Remove from class</option></select></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </Modal>
  );
}

function WaitingDialog({ levelId, classes, onClose }: { levelId: string; classes: Cls[]; onClose: () => void }) {
  const { data, loading, error, reload } = useApi<{ waiting: { id: string; name: string; email: string; score: number | null; source: string | null }[] }>(`/api/admin/classes/assign?level=${levelId}`);
  const [err, setErr] = useState("");
  const put = async (userId: string, classId: string) => { setErr(""); try { await api("/api/admin/classes/assign", { json: { userId, classId } }); reload(); } catch (e) { setErr((e as Error).message); } };
  return (
    <Modal title="Waiting for a class" onClose={onClose} wide>
      <div className="flex flex-col gap-3 text-sm">
        <ErrorNote text={error || err} />
        {loading && !data ? <Loading /> : (data?.waiting.length ?? 0) === 0 ? <p className="text-ink-soft">Nobody is waiting.</p> : (
          <ul className="divide-y divide-line">{data!.waiting.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b className="text-navy">{w.name}</b> <span className="text-xs text-ink-soft">{w.email} · score {w.score ?? "-"}</span></span>
              <select className="field min-h-[38px] w-auto py-1" aria-label={`Place ${w.name}`} value="" onChange={(e) => e.target.value && put(w.id, e.target.value)}><option value="">Place in…</option>{classes.map((c) => <option key={c.id} value={c.id} disabled={c.students >= c.capacity}>{c.name} ({c.capacity - c.students} left)</option>)}</select></li>
          ))}</ul>
        )}
      </div>
    </Modal>
  );
}

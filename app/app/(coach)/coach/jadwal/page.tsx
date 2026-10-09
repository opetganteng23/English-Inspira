"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Slot = { id: string; title: string; startsAt: string; endsAt: string; mode: "online" | "offline"; meetingUrl: string; room: string; capacity: number; booked: number; status: "draft" | "published" | "cancelled"; levelId: string | null; cancelReason: string | null };
type D = { levels: { id: string; name: string }[]; slots: Slot[] };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const ST = { draft: ["Draft", "badge-muted"], published: ["Published", "badge-ok"], cancelled: ["Cancelled", "badge-bad"] } as const;
// <input type="datetime-local"> memakai waktu lokal tanpa zona
const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function Jadwal() {
  const { data, loading, error, reload } = useApi<D>("/api/coach/slots");
  const [edit, setEdit] = useState<Partial<Slot> | null>(null);
  const [err, setErr] = useState("");
  const act = async (id: string, body: object) => { setErr(""); try { await api(`/api/coach/slots/${id}`, { json: body }); reload(); } catch (e) { setErr((e as Error).message); } };

  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Slot schedule</h1><p className="text-sm text-ink-soft">Create slots and publish them so participants can book. Cancelled slots do not use participants’ quota.</p></div>
        <button className="btn-solid" onClick={() => setEdit({ mode: "online", capacity: 1 })}>+ New slot</button>
      </div>
      <ErrorNote text={error || err} />
      <div className="table-wrap"><table>
        <thead><tr><th>Waktu</th><th>Mode</th><th>Terisi</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data?.slots.map((s) => (
            <tr key={s.id}>
              <td className="font-semibold text-navy">{tgl(s.startsAt, true)}<br /><span className="text-xs font-normal text-ink-soft">{s.title}{s.cancelReason ? ` · cancelled: ${s.cancelReason}` : ""}</span></td>
              <td>{s.mode === "online" ? "Online" : `Tatap muka${s.room ? ` (${s.room})` : ""}`}</td><td>{s.booked}/{s.capacity}</td>
              <td><span className={ST[s.status][1]}>{ST[s.status][0]}</span></td>
              <td className="whitespace-nowrap text-right">
                {s.status !== "cancelled" && <button className="mr-3 font-semibold text-brand" onClick={() => setEdit(s)}>Edit</button>}
                {s.status === "draft" && <button className="mr-3 font-semibold text-brand" onClick={() => act(s.id, { action: "publish" })}>Publish</button>}
                {s.status === "published" && s.booked === 0 && <button className="mr-3 font-semibold text-brand" onClick={() => act(s.id, { action: "unpublish" })}>Unpublish</button>}
                {s.status !== "cancelled" && <button className="font-semibold text-red-700" onClick={() => { const reason = prompt(s.booked ? `Cancel this slot? ${s.booked} participants will be notified. Reason:` : "Cancellation reason:"); if (reason) act(s.id, { action: "cancel", reason }); }}>Batalkan</button>}
              </td>
            </tr>
          ))}
          {data?.slots.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No slots yet.</td></tr>}
        </tbody>
      </table></div>
      {edit && data && <Editor init={edit} levels={data.levels} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function Editor({ init, levels, onClose, onSaved }: { init: Partial<Slot>; levels: D["levels"]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: init.title ?? "", startsAt: init.startsAt ? toLocal(init.startsAt) : "", endsAt: init.endsAt ? toLocal(init.endsAt) : "", mode: init.mode ?? "online", meetingUrl: init.meetingUrl ?? "", room: init.room ?? "", capacity: init.capacity ?? 1, levelId: init.levelId ?? "" });
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    try {
      const body = { title: v.title || undefined, startsAt: new Date(v.startsAt).toISOString(), endsAt: new Date(v.endsAt).toISOString(), mode: v.mode, meetingUrl: v.mode === "online" ? v.meetingUrl || undefined : undefined, room: v.mode === "offline" ? v.room || undefined : undefined, capacity: Number(v.capacity), levelId: v.levelId || null };
      await api(init.id ? `/api/coach/slots/${init.id}` : "/api/coach/slots", { method: init.id ? "PUT" : "POST", json: body });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={init.id ? "Edit slot" : "New slot"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Title (optional)<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Start<input className="field font-normal" type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} /></label>
          <label className={label}>Done<input className="field font-normal" type="datetime-local" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></label>
          <label className={label}>Mode<select className="field font-normal" value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value as "online" | "offline" })}><option value="online">Online</option><option value="offline">Tatap muka</option></select></label>
          <label className={label}>Kapasitas<input className="field font-normal" type="number" min={1} max={100} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} /></label>
        </div>
        {v.mode === "online" ? <label className={label}>Meeting link (https)<input className="field font-normal" value={v.meetingUrl} onChange={(e) => setV({ ...v, meetingUrl: e.target.value })} /></label> : <label className={label}>Room<input className="field font-normal" value={v.room} onChange={(e) => setV({ ...v, room: e.target.value })} /></label>}
        <label className={label}>Level only<select className="field font-normal" value={v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })}><option value="">All levels</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        {init.id && (init.booked ?? 0) > 0 && <p className="text-xs text-ink-soft">Changing the time or place emails a notification to {init.booked} participants; quotas do not change.</p>}
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!v.startsAt || !v.endsAt} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { ImportPanel } from "@/components/ImportPanel";
import { Loading, ErrorNote } from "@/components/Charts";

type I = { id: string; name: string; code: string; seats: number; seatsUsed: number; contactEmail: string; batch: string; contractStart: string | null; contractEnd: string | null; status: "active" | "inactive"; coaches: number; admins: number };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const day = (d: string | null) => (d ? d.slice(0, 10) : "");

export default function Institusi() {
  const { data, loading, error, reload } = useApi<{ institutions: I[] }>("/api/admin/institutions");
  const [edit, setEdit] = useState<Partial<I> | null>(null);
  const [manage, setManage] = useState<I | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Institution</h1><p className="text-sm text-ink-soft">Contract, seats, and participants of each partner institution. Participant access ends on the contract end date.</p></div><button className="btn-solid" onClick={() => setEdit({ status: "active", seats: 50 })}>+ New institution</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Institution</th><th>Seats</th><th>Contract</th><th>Coaches / Admins</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.institutions.map((i) => <tr key={i.id}><td className="font-semibold text-navy">{i.name}<br /><span className="text-xs font-normal text-ink-soft">{i.batch || i.code}</span></td><td>{i.seatsUsed}/{i.seats}</td><td>{i.contractStart ? tgl(i.contractStart) : "-"} to {i.contractEnd ? tgl(i.contractEnd) : "no limit"}</td><td>{i.coaches} / {i.admins}</td><td><span className={i.status === "active" ? "badge-ok" : "badge-muted"}>{i.status === "active" ? "Active" : "Inactive"}</span></td>
              <td className="whitespace-nowrap text-right"><Link className="mr-3 font-semibold text-brand" href={`/institusi?institution=${i.id}`}>Portal</Link><button className="mr-3 font-semibold text-brand" onClick={() => setManage(i)}>Add participants</button><button className="font-semibold text-brand" onClick={() => setEdit(i)}>Edit</button></td></tr>)}
            {data?.institutions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">No institutions yet.</td></tr>}
          </tbody>
        </table></div>
      )}
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {manage && <Modal title={`${manage.name}: add participants`} onClose={() => { setManage(null); reload(); }} wide><ImportPanel base={`/api/admin/institutions/${manage.id}`} /></Modal>}
    </div>
  );
}

function Editor({ init, onClose, onSaved }: { init: Partial<I>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: init.name ?? "", code: init.code ?? "", seats: init.seats ?? 50, contactEmail: init.contactEmail ?? "", batch: init.batch ?? "", contractStart: day(init.contractStart ?? null), contractEnd: day(init.contractEnd ?? null), status: init.status ?? "active" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try { await api(init.id ? `/api/admin/institutions/${init.id}` : "/api/admin/institutions", { method: init.id ? "PATCH" : "POST", json: { ...v, seats: Number(v.seats), contractStart: v.contractStart || null, contractEnd: v.contractEnd || null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title={init.id ? "Edit institution" : "New institution"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Institution name<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Internal code<input className="field font-normal uppercase" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></label>
          <label className={label}>Number of seats<input className="field font-normal" type="number" min={0} value={v.seats} onChange={(e) => setV({ ...v, seats: Number(e.target.value) })} /></label>
          <label className={label}>Contract start<input className="field font-normal" type="date" value={v.contractStart} onChange={(e) => setV({ ...v, contractStart: e.target.value })} /></label>
          <label className={label}>Contract end<input className="field font-normal" type="date" value={v.contractEnd} onChange={(e) => setV({ ...v, contractEnd: e.target.value })} /></label>
        </div>
        <label className={label}>Batch<input className="field font-normal" value={v.batch} onChange={(e) => setV({ ...v, batch: e.target.value })} placeholder="Batch 2026" /></label>
        <label className={label}>Email kontak<input className="field font-normal" type="email" value={v.contactEmail} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.status === "active"} onChange={(e) => setV({ ...v, status: e.target.checked ? "active" : "inactive" })} />Active</label>
        {init.id && <p className="text-xs text-ink-soft">Changing the contract end date automatically updates access for all participants.</p>}
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </Modal>
  );
}

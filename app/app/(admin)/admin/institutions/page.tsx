"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { askConfirm } from "@/components/Feedback";
import { ImportPanel } from "@/components/ImportPanel";
import { Loading, ErrorNote } from "@/components/Charts";

type I = { id: string; name: string; code: string; seats: number; seatsUsed: number; contactEmail: string; batch: string; contractStart: string | null; contractEnd: string | null; status: "active" | "inactive"; coaches: number; admins: number; holdPlacementResults?: boolean; heldResults?: number };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const day = (d: string | null) => (d ? d.slice(0, 10) : "");

export default function Institusi() {
  const { data, loading, error, reload } = useApi<{ institutions: I[] }>("/api/admin/institutions");
  const [edit, setEdit] = useState<Partial<I> | null>(null);
  const [manage, setManage] = useState<I | null>(null);
  const [personnel, setPersonnel] = useState<I | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Institution</h1><p className="text-sm text-ink-soft">Contract, seats, and participants of each partner institution. Participant access ends on the contract end date.</p></div><button className="btn-solid" onClick={() => setEdit({ status: "active", seats: 50 })}>+ New institution</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Institution</th><th>Seats</th><th>Contract</th><th>Coaches / Admins</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.institutions.map((i) => <tr key={i.id}><td className="font-semibold text-navy">{i.name}<br /><span className="text-xs font-normal text-ink-soft">{i.code}{i.batch ? ` · ${i.batch}` : ""}</span></td><td>{i.seatsUsed}/{i.seats}</td><td>{i.contractStart ? tgl(i.contractStart) : "-"} to {i.contractEnd ? tgl(i.contractEnd) : "no limit"}</td><td>{i.coaches} / {i.admins}</td><td><span className={i.status === "active" ? "badge-ok" : "badge-muted"}>{i.status === "active" ? "Active" : "Inactive"}</span>{i.holdPlacementResults && <span className="badge-warn ml-1" title="Placement results are held">Results held ({i.heldResults ?? 0})</span>}</td>
              <td className="whitespace-nowrap text-right"><Link className="mr-3 font-semibold text-brand" href={`/institution?institution=${i.id}`}>Portal</Link><button className="mr-3 font-semibold text-brand" onClick={() => setManage(i)}>Add participants</button><button className="mr-3 font-semibold text-brand" onClick={() => setPersonnel(i)}>Personnel data</button><button className="font-semibold text-brand" onClick={() => setEdit(i)}>Edit</button></td></tr>)}
            {data?.institutions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">No institutions yet.</td></tr>}
          </tbody>
        </table></div>
      )}
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {personnel && <Modal title={`${personnel.name}: personnel data`} onClose={() => setPersonnel(null)} wide><PersonnelImport id={personnel.id} /></Modal>}
      {manage && <Modal title={`${manage.name}: add participants`} onClose={() => { setManage(null); reload(); }} wide><ImportPanel base={`/api/admin/institutions/${manage.id}`} /></Modal>}
    </div>
  );
}

type PR = { dry: boolean; rows: number; matched: number; updated: number; unmatched: string[]; unmatchedCount: number; badDate: number; unmappedBranches: string[]; missing: string[] };
/** Impor data kepegawaian dari HR (cabang, tanggal lahir, jenis kelamin, status, jabatan): pratinjau dulu, lalu simpan. */
function PersonnelImport({ id }: { id: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<PR | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(dry: boolean) {
    if (!file) return;
    setBusy(true); setErr("");
    try { const fd = new FormData(); fd.append("file", file); setRes(await api<PR>(`/api/admin/institutions/${id}/personnel${dry ? "?dry=1" : ""}`, { method: "POST", body: fd })); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-ink-soft">Upload the HR Excel file. Rows are matched to participants by office email (or personal email). Columns used: gender, place and date of birth, employment status, branch/location and job title. NIK and personal email are not stored (personal email is only used for matching). This data is confidential (NDA): only central admins and this institution&apos;s admins can see it.</p>
      <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); }} />
      <ErrorNote text={err} />
      {res && (
        <div className="rounded-xl bg-canvas p-4">
          <p className="font-semibold text-navy">{res.dry ? "Preview (nothing saved yet)" : "Imported"}</p>
          <p>{res.rows} rows · <b>{res.matched}</b> matched to participants{!res.dry ? ` · ${res.updated} profiles updated` : ""} · {res.unmatchedCount} not found</p>
          {res.badDate > 0 && <p className="text-red-700">{res.badDate} rows have a date of birth that could not be read.</p>}
          {res.unmappedBranches.length > 0 && <p>Branches without a map location: {res.unmappedBranches.join(", ")}</p>}
          {res.missing.length > 0 && <p className="text-ink-soft">Columns not found: {res.missing.join(", ")}</p>}
          {res.unmatched.length > 0 && <p className="text-ink-soft">Not found (first {res.unmatched.length}): {res.unmatched.join(", ")}</p>}
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn-outline" disabled={!file || busy} onClick={() => send(true)}>Preview</button>
        <button className="btn-solid" disabled={!file || busy || !res?.dry} onClick={() => send(false)}>{busy ? "Working…" : "Import"}</button>
      </div>
    </div>
  );
}

function Editor({ init, onClose, onSaved }: { init: Partial<I>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: init.name ?? "", code: init.code ?? "", seats: init.seats ?? 50, contactEmail: init.contactEmail ?? "", batch: init.batch ?? "", contractStart: day(init.contractStart ?? null), contractEnd: day(init.contractEnd ?? null), status: init.status ?? "active", holdPlacementResults: !!init.holdPlacementResults });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (init.holdPlacementResults && !v.holdPlacementResults && !(await askConfirm(`Release placement results now? ${init.heldResults ?? 0} held result(s) become visible to participants, institution admins, and coaches, and result emails are sent.`, { confirmLabel: "Release results" }))) return;
    setBusy(true); setErr("");
    try { await api(init.id ? `/api/admin/institutions/${init.id}` : "/api/admin/institutions", { method: init.id ? "PATCH" : "POST", json: { ...v, seats: Number(v.seats), contractStart: v.contractStart || null, contractEnd: v.contractEnd || null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title={init.id ? "Edit institution" : "New institution"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Institution name<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Institution code (participants use it to register)<input className="field font-normal uppercase" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></label>
          <label className={label}>Number of seats<input className="field font-normal" type="number" min={0} value={v.seats} onChange={(e) => setV({ ...v, seats: Number(e.target.value) })} /></label>
          <label className={label}>Contract start<input className="field font-normal" type="date" value={v.contractStart} onChange={(e) => setV({ ...v, contractStart: e.target.value })} /></label>
          <label className={label}>Contract end<input className="field font-normal" type="date" value={v.contractEnd} onChange={(e) => setV({ ...v, contractEnd: e.target.value })} /></label>
        </div>
        <label className={label}>Batch<input className="field font-normal" value={v.batch} onChange={(e) => setV({ ...v, batch: e.target.value })} placeholder="Batch 2026" /></label>
        <label className={label}>Contact email<input className="field font-normal" type="email" value={v.contactEmail} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.status === "active"} onChange={(e) => setV({ ...v, status: e.target.checked ? "active" : "inactive" })} />Active</label>
        <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={v.holdPlacementResults} onChange={(e) => setV({ ...v, holdPlacementResults: e.target.checked })} /><span><b className="text-navy">Hold placement results</b><br /><span className="text-ink-soft">Participants can take the placement test, but their score, level, report, and AI analysis stay hidden from them, the institution admin, and coaches until you turn this off. Turning it off releases all held results at once.{init.holdPlacementResults ? ` Currently held: ${init.heldResults ?? 0}.` : ""}</span></span></label>
        {init.id && <p className="text-xs text-ink-soft">Changing the contract end date automatically updates access for all participants.</p>}
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </Modal>
  );
}

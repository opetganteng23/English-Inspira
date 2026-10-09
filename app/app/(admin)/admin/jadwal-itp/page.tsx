"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type S = { id: string; title: string; date: string; place: string; organizer?: string; quota: number; registered: number; status: "open" | "closed" | "done"; docsValid: number; docsPending: number; scored: number; total: number };
type Row = { id: string; fullName: string; nikLast4: string; email?: string; phone: string | null; docStatus: "pending" | "valid" | "rejected"; docNote: string | null; status: string; score: { listening: number; structure: number; reading: number; total: number } | null; idPhotoAssetId: string; facePhotoAssetId: string };
type Roster = { session: { id: string; title: string; date: string; place: string; quota: number; registered: number }; roster: Row[] };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const DOC = { pending: ["Needs verification", "badge-warn"], valid: ["Valid", "badge-ok"], rejected: ["Rejected", "badge-bad"] } as const;
const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function JadwalItp() {
  const { data, loading, error, reload } = useApi<{ sessions: S[] }>("/api/admin/itp-sessions");
  const [edit, setEdit] = useState<Partial<S> | null>(null);
  const [roster, setRoster] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Official TOEFL ITP schedule</h1><p className="text-sm text-ink-soft">Quota, roster, document verification, and score input.</p></div><button className="btn-solid" onClick={() => setEdit({ status: "open", quota: 30 })}>+ Add session</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Session</th><th>Date</th><th>Quota</th><th>Documents</th><th>Score</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.sessions.map((s) => <tr key={s.id}><td className="font-semibold text-navy">{s.title}<br /><span className="text-xs font-normal text-ink-soft">{s.place}</span></td><td className="whitespace-nowrap">{tgl(s.date, true)}</td><td>{s.registered}/{s.quota}</td>
              <td className="text-xs">{s.docsValid} valid · {s.docsPending > 0 ? <b className="text-accent-dark">{s.docsPending} need verification</b> : "0 waiting"}</td><td className="text-xs">{s.scored}/{s.total} entered</td>
              <td><span className={s.status === "open" ? "badge-ok" : "badge-muted"}>{s.status === "open" ? "Open" : s.status === "closed" ? "Closed" : "Done"}</span></td>
              <td className="whitespace-nowrap text-right"><button className="mr-3 font-semibold text-brand" onClick={() => setRoster(s.id)}>Roster</button><button className="font-semibold text-brand" onClick={() => setEdit(s)}>Edit</button></td></tr>)}
            {data?.sessions.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">No sessions yet.</td></tr>}
          </tbody>
        </table></div>
      )}
      {edit && <SessionEditor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {roster && <RosterModal id={roster} onClose={() => { setRoster(null); reload(); }} />}
    </div>
  );
}

function SessionEditor({ init, onClose, onSaved }: { init: Partial<S>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: init.title ?? "", date: init.date ? toLocal(init.date) : "", place: init.place ?? "", organizer: init.organizer ?? "", quota: init.quota ?? 30, status: init.status ?? "open" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try { await api(init.id ? `/api/admin/itp-sessions/${init.id}` : "/api/admin/itp-sessions", { method: init.id ? "PATCH" : "POST", json: { ...v, date: new Date(v.date).toISOString(), quota: Number(v.quota), organizer: v.organizer || undefined } }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() { if (!confirm("Delete this session?")) return; try { await api(`/api/admin/itp-sessions/${init.id}`, { method: "DELETE" }); onSaved(); } catch (e) { setErr((e as Error).message); } }
  return (
    <Modal title={init.id ? "Edit session" : "New session"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Title<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="TOEFL ITP Sabtu, 21 Nov" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Date & time<input className="field font-normal" type="datetime-local" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></label>
          <label className={label}>Quota<input className="field font-normal" type="number" min={1} value={v.quota} onChange={(e) => setV({ ...v, quota: Number(e.target.value) })} /></label>
        </div>
        <label className={label}>Lokasi<input className="field font-normal" value={v.place} onChange={(e) => setV({ ...v, place: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Penyelenggara<input className="field font-normal" value={v.organizer} onChange={(e) => setV({ ...v, organizer: e.target.value })} /></label>
          <label className={label}>Status<select className="field font-normal" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as S["status"] })}><option value="open">Registration open</option><option value="closed">Closed</option><option value="done">Done</option></select></label>
        </div>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">{init.id ? <button className="btn-danger" onClick={remove}>Delete</button> : <span />}<div className="flex flex-col-reverse gap-2 sm:flex-row"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !v.date} onClick={save}>{busy ? "Saving…" : "Save"}</button></div></div>
      </div>
    </Modal>
  );
}

function RosterModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, reload } = useApi<Roster>(`/api/admin/itp-sessions/${id}/roster`);
  const [scores, setScores] = useState<Record<string, { l: string; s: string; r: string }>>({});
  const [rej, setRej] = useState<{ id: string; note: string } | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [nik, setNik] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string) => { setMsg(null); try { await fn(); if (ok) setMsg({ ok: true, text: ok }); reload(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } };

  async function importScores(file?: File) {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    await run(async () => { const r = await fetch(`/api/admin/itp-sessions/${id}/scores`, { method: "POST", body: fd }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setMsg({ ok: !d.errors.length, text: `${d.ok} scores imported${d.errors.length ? `, ${d.errors.length} failed: ${d.errors.slice(0, 3).map((e: { row: number; error: string }) => `row ${e.row} (${e.error})`).join("; ")}` : ""}` }); });
  }
  return (
    <Modal title={data ? `Roster: ${data.session.title}` : "Roster"} onClose={onClose} wide>
      {!data ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-ink-soft">{tgl(data.session.date, true)} · {data.session.place} · {data.session.registered}/{data.session.quota} registered</p>
            <div className="flex flex-wrap gap-2"><a className="btn-outline !min-h-[40px]" href={`/api/admin/itp-sessions/${id}/export.xlsx`}>Export to partner (Excel)</a><label className="btn-outline !min-h-[40px] cursor-pointer">Import scores<input type="file" accept=".xlsx" className="hidden" onChange={(e) => { importScores(e.target.files?.[0]); e.target.value = ""; }} /></label></div></div>
          <p className="rounded-lg bg-canvas p-3 text-xs text-ink-soft">The export includes full national ID numbers, and every export, ID display, or document photo view is recorded in the audit log. The total score is calculated automatically from the 3 section scores (31-68).</p>
          {msg && <p role="status" className={`rounded-lg p-3 ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <div className="table-wrap"><table>
            <thead><tr><th>Participant (as on ID card)</th><th>Documents</th><th>Score L / S / R</th><th>Total</th></tr></thead>
            <tbody>
              {data.roster.map((r) => {
                const sc = scores[r.id] ?? { l: r.score?.listening?.toString() ?? "", s: r.score?.structure?.toString() ?? "", r: r.score?.reading?.toString() ?? "" };
                return (
                  <tr key={r.id} className="align-top">
                    <td className="font-semibold text-navy">{r.fullName}<br /><span className="text-xs font-normal text-ink-soft">{r.email} · NIK {nik[r.id] ?? `•••• ${r.nikLast4}`}</span><br />
                      <button className="text-xs font-semibold text-brand" onClick={() => run(async () => { const d = await api(`/api/admin/itp-registrations/${r.id}`); setNik((n) => ({ ...n, [r.id]: d.nik })); })}>Show NIK</button> · <button className="text-xs font-semibold text-brand" onClick={() => setView(view === r.id ? null : r.id)}>View photo</button>
                      {view === r.id && <span className="mt-2 flex gap-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img alt="ID card photo" className="h-20 rounded border border-line" src={`/api/assets/${r.idPhotoAssetId}`} />{/* eslint-disable-next-line @next/next/no-img-element */}<img alt="Passport photo" className="h-20 rounded border border-line" src={`/api/assets/${r.facePhotoAssetId}`} /></span>}</td>
                    <td><span className={DOC[r.docStatus][1]}>{DOC[r.docStatus][0]}</span>{r.docNote && <span className="block text-xs text-ink-soft">{r.docNote}</span>}
                      <span className="mt-1 flex gap-2 text-xs font-semibold"><button className="text-success" onClick={() => run(() => api(`/api/admin/itp-registrations/${r.id}`, { method: "PATCH", json: { docStatus: "valid" } }))}>Valid</button><button className="text-red-700" onClick={() => setRej({ id: r.id, note: "" })}>Reject</button></span>
                      {rej?.id === r.id && <span className="mt-1 flex gap-1"><input aria-label="Reason" className="field !h-9 !text-xs" placeholder="Rejection reason" value={rej.note} onChange={(e) => setRej({ id: r.id, note: e.target.value })} /><button className="btn-danger !min-h-[36px] !px-3 !text-xs" disabled={!rej.note.trim()} onClick={() => run(async () => { await api(`/api/admin/itp-registrations/${r.id}`, { method: "PATCH", json: { docStatus: "rejected", docNote: rej.note } }); setRej(null); })}>Send</button></span>}</td>
                    <td><span className="flex gap-1">{(["l", "s", "r"] as const).map((k) => <input key={k} aria-label={k === "l" ? "Listening" : k === "s" ? "Structure" : "Reading"} className="field !h-9 !w-16 !px-2 text-center" inputMode="numeric" value={sc[k]} onChange={(e) => setScores({ ...scores, [r.id]: { ...sc, [k]: e.target.value } })} />)}</span>
                      <button className="mt-1 text-xs font-semibold text-brand" disabled={!sc.l || !sc.s || !sc.r} onClick={() => run(() => api(`/api/admin/itp-registrations/${r.id}`, { method: "PUT", json: { listening: Number(sc.l), structure: Number(sc.s), reading: Number(sc.r) } }), "Scores saved and certificate issued.")}>Save scores</button></td>
                    <td className="font-display text-lg font-extrabold text-navy">{r.score?.total ?? "-"}</td>
                  </tr>
                );
              })}
              {data.roster.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-ink-soft">No registered participants yet.</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
    </Modal>
  );
}

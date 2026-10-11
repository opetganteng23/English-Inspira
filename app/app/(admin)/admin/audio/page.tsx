"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { Waveform, type Marker } from "@/components/Waveform";
import { computePeaks, mmss as clock } from "@/lib/waveform";

type Row = { id: string; title: string; kind: Kind; description: string; source: string; durationSec: number; size: number; hasTranscript: boolean; createdAt: string; inUse: boolean; usage: { groups: number; questions: number; materials: number } };
type Kind = "short_conversation" | "longer_conversation" | "talk" | "other";
type Detail = Row & { mime: string; peaks: number[]; markers: Marker[]; transcript: string; groups: { id: string; section: string; instruction: string }[]; questions: { id: string; section: string; type: string; stem: string; status: string }[]; materials: { id: string; title: string; status: string }[] };

const KIND: Record<Kind, string> = { short_conversation: "Short conversation", longer_conversation: "Longer conversation", talk: "Talk / lecture", other: "Other" };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mb = (n: number) => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1048576).toFixed(1) + " MB");

export default function AudioLibrary() {
  const { data, loading, error, reload } = useApi<{ audio: Row[] }>("/api/admin/audio");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [dlg, setDlg] = useState<{ type: "upload" } | { type: "edit" | "replace" | "delete"; id: string } | null>(null);
  const [msg, setMsg] = useState("");

  const rows = useMemo(() => (data?.audio ?? []).filter((a) => (!kind || a.kind === kind) && (!q || (a.title + " " + a.description).toLowerCase().includes(q.toLowerCase()))), [data, q, kind]);
  const totals = useMemo(() => ({ n: data?.audio.length ?? 0, unused: (data?.audio ?? []).filter((a) => !a.inUse).length, sec: (data?.audio ?? []).reduce((x, a) => x + a.durationSec, 0) }), [data]);
  const done = (text: string) => { setDlg(null); setMsg(text); reload(); };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Audio Library</h1>
          <p className="text-sm text-ink-soft">All Listening audio in one place. See which questions and materials use each file before you replace or delete it.</p>
        </div>
        <button className="btn-solid" onClick={() => setDlg({ type: "upload" })}>+ Upload audio</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-4"><p className="text-xs font-semibold tracking-wider text-ink-soft">FILES</p><p className="font-display text-2xl font-extrabold text-navy">{totals.n}</p></div>
        <div className="card !p-4"><p className="text-xs font-semibold tracking-wider text-ink-soft">UNUSED</p><p className="font-display text-2xl font-extrabold text-navy">{totals.unused}</p></div>
        <div className="card !p-4"><p className="text-xs font-semibold tracking-wider text-ink-soft">TOTAL LENGTH</p><p className="font-display text-2xl font-extrabold text-navy">{Math.round(totals.sec / 60)} min</p></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Search title or description" aria-label="Search audio" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field w-auto" aria-label="Audio kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All kinds</option>{Object.entries(KIND).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </div>

      {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Audio</th><th>Kind</th><th>Length</th><th>Size</th><th>Used by</th><th /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <Fragment key={a.id}>
                  <tr>
                    <td className="max-w-xs"><b className="text-navy">{a.title}</b>{a.description && <p className="truncate text-xs text-ink-soft">{a.description}</p>}<p className="text-xs text-ink-soft">Added {tgl(a.createdAt)}{a.hasTranscript ? " · has transcript" : " · no transcript"}</p></td>
                    <td><span className="badge-muted">{KIND[a.kind]}</span></td>
                    <td className="whitespace-nowrap">{mmss(a.durationSec)}</td>
                    <td className="whitespace-nowrap">{mb(a.size)}</td>
                    <td className="text-xs">{a.inUse ? <>{a.usage.questions} question{a.usage.questions === 1 ? "" : "s"}<br />{a.usage.materials} material{a.usage.materials === 1 ? "" : "s"}</> : <span className="badge-warn">Unused</span>}</td>
                    <td className="whitespace-nowrap text-right text-sm font-semibold">
                      <button className="mr-3 text-brand" onClick={() => setPlaying(playing === a.id ? null : a.id)}>{playing === a.id ? "Close" : "Play"}</button>
                      <button className="mr-3 text-brand" onClick={() => setDlg({ type: "edit", id: a.id })}>Edit</button>
                      <button className="mr-3 text-brand" onClick={() => setDlg({ type: "replace", id: a.id })}>Replace file</button>
                      <button className="text-red-700" onClick={() => setDlg({ type: "delete", id: a.id })}>Delete</button>
                    </td>
                  </tr>
                  {playing === a.id && (
                    <tr className="bg-canvas"><td colSpan={6}>
                      <div className="flex flex-wrap items-center gap-3 py-1">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <audio key={rate} controls preload="metadata" src={`/api/audio/${a.id}`} className="h-10 min-w-[240px] flex-1" onLoadedMetadata={(e) => { (e.target as HTMLAudioElement).playbackRate = rate; }} />
                        <label className="flex items-center gap-2 text-sm">Speed
                          <select className="field !h-9 w-auto" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{[0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
                        </label>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">{data?.audio.length ? "No audio matches your search." : "No audio yet. Click “Upload audio”."}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {dlg?.type === "upload" && <UploadDialog onClose={() => setDlg(null)} onDone={(t) => done(t)} />}
      {dlg && dlg.type !== "upload" && <ManageDialog mode={dlg.type} id={dlg.id} onClose={() => setDlg(null)} onDone={(t) => done(t)} />}
    </div>
  );
}

function KindSelect({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return <label className={label}>Kind<select className="field font-normal" value={value} onChange={(e) => onChange(e.target.value as Kind)}>{Object.entries(KIND).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>;
}

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: (t: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState({ title: "", kind: "short_conversation" as Kind, description: "", source: "", transcript: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      const peaks = await computePeaks(file);
      if (peaks) fd.append("peaks", JSON.stringify(peaks));
      fd.append("file", file); fd.append("title", v.title); fd.append("kind", v.kind); fd.append("description", v.description); fd.append("source", v.source); fd.append("transcript", v.transcript);
      const r = await fetch("/api/audio", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      onDone(d.deduped ? `This file already exists in the library as “${d.title}”. Nothing was added.` : "Audio uploaded.");
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Upload audio" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Audio file: MP3 (max 15 MB) or WAV (max 30 MB), up to 10 minutes<input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" className="text-sm font-normal" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !v.title) setV((x) => ({ ...x, title: f.name.replace(/\.mp3$/i, "") })); }} /></label>
        <label className={label}>Title<input className="field font-normal" maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <KindSelect value={v.kind} onChange={(k) => setV({ ...v, kind: k })} />
        <label className={label}>Description (optional)<input className="field font-normal" maxLength={500} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <label className={label}>Source / usage rights (optional)<input className="field font-normal" maxLength={200} placeholder="e.g. recorded in-house, licensed from ..." value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} /></label>
        <label className={label}>Transcript (admin only; participants see it after the test)<textarea className="field font-normal" rows={4} value={v.transcript} onChange={(e) => setV({ ...v, transcript: e.target.value })} /></label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !file} onClick={save}>{busy ? "Uploading…" : "Upload"}</button></div>
      </div>
    </Modal>
  );
}

function ManageDialog({ mode, id, onClose, onDone }: { mode: "edit" | "replace" | "delete"; id: string; onClose: () => void; onDone: (t: string) => void }) {
  const { data: d, error } = useApi<Detail>(`/api/admin/audio/${id}`);
  const [v, setV] = useState<{ title: string; kind: Kind; description: string; source: string; transcript: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [markers, setMarkers] = useState<Marker[] | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (d && !markers) setMarkers(d.markers);
  if (d && !peaks) setPeaks(d.peaks);
  // Audio lama tanpa bentuk gelombang: hitung sekali dari berkasnya, lalu simpan.
  useEffect(() => {
    if (mode !== "edit" || !d || d.peaks.length) return;
    let off = false;
    (async () => {
      try { const r = await fetch(`/api/audio/${id}`); const p = await computePeaks(await r.arrayBuffer()); if (p && !off) { setPeaks(p); await api(`/api/audio/${id}`, { method: "PATCH", json: { peaks: p } }); } } catch { /* tampilan saja */ }
    })();
    return () => { off = true; };
  }, [d, id, mode]);
  if (d && !v) setV({ title: d.title, kind: d.kind, description: d.description, source: d.source, transcript: d.transcript });
  const used = d ? d.questions.length + d.materials.length : 0;

  async function run(fn: () => Promise<void>, text: string) { setBusy(true); setErr(""); try { await fn(); onDone(text); } catch (e) { setErr((e as Error).message); setBusy(false); } }
  const usage = d && (d.questions.length > 0 || d.materials.length > 0) && (
    <div className="rounded-xl bg-canvas p-3 text-sm">
      <p className="font-semibold text-navy">Used by</p>
      <ul className="mt-1 max-h-36 list-disc overflow-y-auto pl-5 text-ink-soft">
        {d.questions.map((q) => <li key={q.id}>Question ({q.type}, {q.status}): {q.stem}</li>)}
        {d.materials.map((m) => <li key={m.id}>Material: {m.title}</li>)}
      </ul>
    </div>
  );

  return (
    <Modal title={mode === "edit" ? "Edit audio" : mode === "replace" ? "Replace audio file" : "Delete audio"} onClose={onClose}>
      {!d || !v ? <Loading /> : (
        <div className="flex flex-col gap-4">
          <ErrorNote text={error || err} />
          {mode === "edit" && (
            <>
              <label className={label}>Title<input className="field font-normal" maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
              <KindSelect value={v.kind} onChange={(k) => setV({ ...v, kind: k })} />
              <label className={label}>Description<input className="field font-normal" maxLength={500} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
              <label className={label}>Source / usage rights<input className="field font-normal" maxLength={200} value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} /></label>
              <label className={label}>Transcript<textarea className="field font-normal" rows={6} value={v.transcript} onChange={(e) => setV({ ...v, transcript: e.target.value })} /></label>
              <div className="flex flex-col gap-2"><p className="text-sm font-semibold text-navy">Waveform and timestamps</p>
                <Waveform src={`/api/audio/${id}`} durationSec={d.durationSec} peaks={peaks ?? []} markers={markers ?? []} />
                <div className="flex flex-col gap-2">
                  {(markers ?? []).map((m, i) => (
                    <div key={i} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2">
                      <input className="field min-h-[40px] py-1" type="number" min={0} max={d.durationSec} step={0.5} aria-label={`Time in seconds ${i + 1}`} value={m.t} onChange={(e) => setMarkers((markers ?? []).map((x, k) => (k === i ? { ...x, t: Number(e.target.value) } : x)))} />
                      <input className="field min-h-[40px] py-1" maxLength={80} aria-label={`Label ${i + 1}`} placeholder="Example: Question 1 starts" value={m.label} onChange={(e) => setMarkers((markers ?? []).map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                      <button type="button" className="text-sm font-semibold text-red-700" onClick={() => setMarkers((markers ?? []).filter((_, k) => k !== i))}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="self-start text-sm font-semibold text-brand" disabled={(markers ?? []).length >= 50} onClick={() => setMarkers([...(markers ?? []), { t: 0, label: "" }])}>+ Add timestamp ({clock(d.durationSec)} total)</button>
                </div>
              </div>
              {usage}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button>
                <button className="btn-solid" disabled={busy || !v.title.trim() || (markers ?? []).some((m) => !m.label.trim())} onClick={() => run(async () => { await api(`/api/audio/${id}`, { method: "PATCH", json: { ...v, markers } }); }, "Audio saved.")}>{busy ? "Saving…" : "Save"}</button></div>
            </>
          )}
          {mode === "replace" && (
            <>
              <p className="text-sm text-ink-soft">Upload a corrected MP3 for “{d.title}”. Questions and materials keep pointing to this audio, so nothing needs to be re-linked.</p>
              {used > 0 && <p className="rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">This audio is used by {d.questions.length} question{d.questions.length === 1 ? "" : "s"} and {d.materials.length} material{d.materials.length === 1 ? "" : "s"}. They will play the new file from now on. Results already saved are not recalculated.</p>}
              {usage}
              <label className={label}>New audio file (MP3 or WAV)<input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" className="text-sm font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
              {used > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={sure} onChange={(e) => setSure(e.target.checked)} />I understand that all items above will use the new recording.</label>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button>
                <button className="btn-solid" disabled={busy || !file || (used > 0 && !sure)} onClick={() => run(async () => { const fd = new FormData(); const peaks = await computePeaks(file!); if (peaks) fd.append("peaks", JSON.stringify(peaks)); fd.append("file", file!); const r = await fetch(`/api/audio/${id}`, { method: "PUT", body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Replace failed"); }, "Audio file replaced.")}>{busy ? "Uploading…" : "Replace file"}</button></div>
            </>
          )}
          {mode === "delete" && (
            <>
              {used > 0 ? (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">“{d.title}” cannot be deleted because it is still used. Remove it from the items below first, or replace the file instead.</p>
              ) : <p className="text-sm text-ink-soft">Delete “{d.title}” permanently? The file will be removed from storage. This cannot be undone.</p>}
              {usage}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>{used > 0 ? "Close" : "Cancel"}</button>
                {used === 0 && <button className="btn-danger" disabled={busy} onClick={() => run(async () => { await api(`/api/audio/${id}`, { method: "DELETE" }); }, "Audio deleted.")}>{busy ? "Deleting…" : "Delete audio"}</button>}</div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

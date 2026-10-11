"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Cand = { id: string; name: string; email: string | null; confidence: number };
type Item = { id: string; source: "pure" | "oce"; rawName: string; rawEmail: string | null; score: number | null; itpScore: number | null; cefr: string | null; fileName: string | null; hasFile: boolean; status: string; matchConfidence: number; user: { id: string; name: string; email: string } | null; candidates: Cand[] };
type Scale = { name: string; sameAsItp: boolean; min: number; max: number; anchors: { A2: number | null; B1: number | null; B2: number | null; C1: number | null } };
type Data = { counts: Record<string, number>; institutions: { id: string; name: string }[]; equivalence: { oce: Scale; pure: Scale }; items: Item[] };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function ExternalResults() {
  const [tab, setTab] = useState<"pending" | "confirmed" | "skipped">("pending");
  const { data, loading, error, reload } = useApi<Data>(`/api/admin/external-results?status=${tab}`);
  const [upload, setUpload] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok = "") => { setErr(""); setMsg(""); setBusy(true); try { const r = await fn(); setMsg(typeof r === "string" ? r : ok); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const sure = (data?.items ?? []).filter((i) => i.user && i.matchConfidence >= 0.95 && i.itpScore != null).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">PURE / OCE Results</h1><p className="max-w-3xl text-sm text-ink-soft">Upload participants&apos; PURE or OCE results (Excel, CSV, or one PDF per person). Each result is matched to a participant by email or name. After you confirm, the score sets the participant&apos;s level and coaching quota, and they join a class of that level that still has seats.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-outline" onClick={() => setEqOpen(true)}>Score equivalents</button><button className="btn-solid" onClick={() => setUpload(true)}>+ Upload results</button></div>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {(["pending", "confirmed", "skipped"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-line"}`} onClick={() => setTab(t)}>{t === "pending" ? "To match" : t === "confirmed" ? "Confirmed" : "Skipped"} ({data?.counts[t] ?? 0})</button>)}
        {tab === "pending" && sure > 0 && <button className="btn-solid ml-auto" disabled={busy} onClick={() => run(async () => { const r = await api<{ confirmed: number; failed: { name: string; reason: string }[] }>("/api/admin/external-results/confirm-matched", { json: {} }); return `${r.confirmed} confirmed.${r.failed.length ? ` ${r.failed.length} need review: ${r.failed.map((f) => `${f.name} (${f.reason})`).join("; ")}` : ""}`; })}>Confirm {sure} sure matches</button>}
      </div>
      <ErrorNote text={error || err} />
      {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      {loading && !data ? <Loading /> : data?.items.length === 0 ? <p className="card text-sm text-ink-soft">{tab === "pending" ? "Nothing to match. Upload PURE or OCE results to start." : "No results here yet."}</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name in file</th><th>Score</th><th>Participant</th><th>Match</th><th></th></tr></thead>
            <tbody>
              {data?.items.map((i) => <Row key={i.id} i={i} tab={tab} busy={busy} run={run} />)}
            </tbody>
          </table>
        </div>
      )}
      {upload && data && <UploadDialog institutions={data.institutions} onClose={() => setUpload(false)} onDone={(t) => { setUpload(false); setTab("pending"); setMsg(t); reload(); }} />}
      {eqOpen && data && <EquivalenceDialog init={data.equivalence} onClose={() => setEqOpen(false)} onSaved={() => { setEqOpen(false); setMsg("Score equivalents saved. Confirmed results keep the TOEFL ITP score they had."); reload(); }} />}
    </div>
  );
}

function Row({ i, tab, busy, run }: { i: Item; tab: string; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const [score, setScore] = useState(i.score == null ? "" : String(i.score));
  const options = [...(i.user && !i.candidates.some((c) => c.id === i.user!.id) ? [{ id: i.user.id, name: i.user.name, email: i.user.email, confidence: 1 }] : []), ...i.candidates];
  const sure = i.matchConfidence >= 0.95;
  return (
    <tr>
      <td><b className="text-navy">{i.rawName}</b><br /><span className="text-xs text-ink-soft">{i.source.toUpperCase()}{i.rawEmail ? ` · ${i.rawEmail}` : ""}{i.fileName ? ` · ${i.fileName}` : ""}</span>{i.hasFile && <><br /><a className="text-xs font-semibold text-brand" href={`/api/admin/external-results/${i.id}`} target="_blank" rel="noreferrer">Open PDF</a></>}</td>
      <td>
        {tab === "pending"
          ? <input className="field min-h-[38px] w-24 py-1" inputMode="decimal" aria-label={`Score for ${i.rawName}`} value={score} onChange={(e) => setScore(e.target.value)} onBlur={() => { const v = score.trim() === "" ? null : Number(score); if (v !== i.score && (v === null || Number.isFinite(v))) void run(() => api(`/api/admin/external-results/${i.id}`, { method: "PATCH", json: { score: v } })); }} />
          : <b>{i.score ?? "-"}</b>}
        {i.itpScore != null && <span className="block text-xs text-ink-soft">ITP {i.itpScore} · CEFR {i.cefr}</span>}
      </td>
      <td>
        {tab === "pending"
          ? <select className="field min-h-[38px] py-1" aria-label={`Participant for ${i.rawName}`} value={i.user?.id ?? ""} onChange={(e) => run(() => api(`/api/admin/external-results/${i.id}`, { method: "PATCH", json: { userId: e.target.value || null } }))}>
              <option value="">Not matched</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ""}</option>)}
            </select>
          : <span>{i.user ? <>{i.user.name}<br /><span className="text-xs text-ink-soft">{i.user.email}</span></> : "-"}</span>}
        {tab === "pending" && <SearchPerson onPick={(id) => run(() => api(`/api/admin/external-results/${i.id}`, { method: "PATCH", json: { userId: id } }))} />}
      </td>
      <td>{i.user ? <span className={sure ? "badge-ok" : "badge-warn"}>{sure ? "Sure" : `Check (${pct(i.matchConfidence)})`}</span> : <span className="badge-bad">No match</span>}</td>
      <td className="whitespace-nowrap text-sm font-semibold">
        {tab === "pending" && <span className="flex flex-wrap gap-3"><button className="text-brand disabled:opacity-50" disabled={busy || !i.user || i.itpScore == null} onClick={() => run(async () => { const r = await api<{ level: string; classId: string | null }>(`/api/admin/external-results/${i.id}`, { json: { action: "confirm" } }); return `${i.rawName}: ${r.level} level, ${r.classId ? "placed in a class" : "waiting for a class (no seats yet)"}.`; })}>Confirm</button><button className="text-ink-soft" onClick={() => run(() => api(`/api/admin/external-results/${i.id}`, { json: { action: "skip" } }), "Skipped")}>Skip</button><button className="text-red-700" onClick={() => confirm("Delete this result?") && run(() => api(`/api/admin/external-results/${i.id}`, { method: "DELETE" }), "Deleted")}>Delete</button></span>}
        {tab === "skipped" && <button className="text-brand" onClick={() => run(() => api(`/api/admin/external-results/${i.id}`, { json: { action: "reopen" } }), "Moved back to matching")}>Back to matching</button>}
      </td>
    </tr>
  );
}

/** Cari peserta lain bila kandidat otomatis salah. */
function SearchPerson({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const { data } = useApi<{ participants?: { id: string; name: string | null; email: string }[]; items?: { id: string; name: string | null; email: string }[] }>(q.trim().length >= 2 ? `/api/admin/participants?q=${encodeURIComponent(q.trim())}` : null);
  const list = (data?.participants ?? data?.items ?? []).slice(0, 6);
  return (
    <div className="relative mt-1">
      <input className="field min-h-[34px] py-1 text-xs" placeholder="Search another participant" aria-label="Search another participant" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length > 0 && <ul className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-white shadow">{list.map((p) => <li key={p.id}><button type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-canvas" onClick={() => { onPick(p.id); setQ(""); }}>{p.name ?? p.email}<br /><span className="text-ink-soft">{p.email}</span></button></li>)}</ul>}
    </div>
  );
}

function UploadDialog({ institutions, onClose, onDone }: { institutions: Data["institutions"]; onClose: () => void; onDone: (t: string) => void }) {
  const [source, setSource] = useState<"pure" | "oce">("pure");
  const [inst, setInst] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (!files?.length) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("source", source); if (inst) fd.append("institutionId", inst);
      for (const f of [...files]) fd.append("files", f);
      const r = await fetch("/api/admin/external-results", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      onDone(`${d.created} result${d.created === 1 ? "" : "s"} added, ${d.matched} matched automatically.${d.errors?.length ? ` Not read: ${d.errors.map((e: { file: string; reason: string }) => `${e.file} (${e.reason})`).join("; ")}` : ""}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Upload PURE / OCE results" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft"><b>Excel or CSV:</b> one row per person with the columns <code>name</code> and <code>score</code>; <code>email</code>, <code>date</code>, and <code>test</code> (PURE or OCE) are optional. <b>PDF:</b> one file per person; the name is read from the PDF text, or from the file name, and the score from the text when possible. You can fix any score or match before confirming.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Test<select className="field font-normal" value={source} onChange={(e) => setSource(e.target.value as "pure" | "oce")}><option value="pure">PURE</option><option value="oce">OCE</option></select></label>
          <label className={label}>Match within<select className="field font-normal" value={inst} onChange={(e) => setInst(e.target.value)}><option value="">All institutions</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        </div>
        <label className={label}>Files<input type="file" multiple accept=".csv,.xlsx,.pdf" className="text-sm font-normal" aria-label="Result files" onChange={(e) => setFiles(e.target.files)} /></label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !files?.length} onClick={save}>{busy ? "Reading files…" : "Upload"}</button></div>
      </div>
    </Modal>
  );
}

function EquivalenceDialog({ init, onClose, onSaved }: { init: Data["equivalence"]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(init);
  const [err, setErr] = useState("");
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const set = (k: "oce" | "pure", patch: Partial<Scale>) => setV({ ...v, [k]: { ...v[k], ...patch } });
  return (
    <Modal title="Score equivalents" onClose={onClose} wide>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">TOEFL ITP to CEFR uses the boundaries published by ETS: A2 from 337, B1 from 460, B2 from 543, C1 from 627. For OCE and PURE, either keep the TOEFL ITP scale or enter that test&apos;s own range and the lowest score for each CEFR level. Scores in between are converted proportionally. These conversions are guides for placement, so use figures from the test provider.</p>
        {(["pure", "oce"] as const).map((k) => (
          <fieldset key={k} className="rounded-xl border border-line p-3">
            <legend className="px-1 font-semibold text-navy">{v[k].name}</legend>
            <label className="flex min-h-[40px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={v[k].sameAsItp} onChange={(e) => set(k, { sameAsItp: e.target.checked, ...(e.target.checked ? { min: 310, max: 677 } : {}) })} />Uses the TOEFL ITP scale (310 to 677)</label>
            {!v[k].sameAsItp && (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className={label}>Lowest<input className="field font-normal" inputMode="decimal" value={v[k].min} onChange={(e) => set(k, { min: Number(e.target.value) })} /></label>
                {(["A2", "B1", "B2", "C1"] as const).map((c) => <label key={c} className={label}>{c} from<input className="field font-normal" inputMode="decimal" value={v[k].anchors[c] ?? ""} onChange={(e) => set(k, { anchors: { ...v[k].anchors, [c]: num(e.target.value) } })} /></label>)}
                <label className={label}>Highest<input className="field font-normal" inputMode="decimal" value={v[k].max} onChange={(e) => set(k, { max: Number(e.target.value) })} /></label>
              </div>
            )}
          </fieldset>
        ))}
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" onClick={async () => { setErr(""); try { await api("/api/admin/score-equivalence", { method: "PUT", json: v }); onSaved(); } catch (e) { setErr((e as Error).message); } }}>Save</button></div>
      </div>
    </Modal>
  );
}

"use client";

import { useRef, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Sc = { listening?: number; structure?: number; reading?: number; total?: number };
type Item = { id: string; filename: string; status: "uploaded" | "extracted" | "verified" | "analyzed"; template: string; parsed: Sc; verified: Sc; hasFile: boolean; createdAt: string };
type Detail = { analysis: { status: string; engine: string | null; narrative: { summary: string; narrative: string; suggestions: string[]; weaknesses: { topic: string; evidence: string }[]; strengths: { topic: string; evidence: string }[] } | null } | null };
const FIELDS = [["listening", "Listening (31-68)"], ["structure", "Structure & Written Expression (31-68)"], ["reading", "Reading (31-68)"], ["total", "Total score (310-677, automatic when all 3 sections are filled)"]] as const;
const STATUS: Record<string, string> = { extracted: "Needs verification", uploaded: "Processing", verified: "Verified", analyzed: "Analyzed" };

export default function UnggahHasil() {
  const { data, loading, error, reload } = useApi<{ imports: Item[] }>("/api/analytics/pdf");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function upload() {
    const f = file.current?.files?.[0];
    if (!f) return setErr("Choose a PDF file first");
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/analytics/pdf", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Upload failed");
      if (file.current) file.current.value = "";
      setOpen(d.id); reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div><h1 className="page-title">Upload External Results</h1><p className="mt-1 text-ink-soft">Upload a PDF score report from another test (e.g. TOEFL ITP) to get an analysis. You can correct the scores that were read first. The file is not sent to the AI; only the scores you confirm are analyzed.</p></div>
      <section className="card flex flex-col gap-3">
        <input ref={file} type="file" accept="application/pdf,.pdf" aria-label="File PDF" className="field" />
        <p className="text-xs text-ink-soft">PDF, max 10 MB. Scanned PDFs (images) may not be readable; you can enter the scores manually.</p>
        <ErrorNote text={err || error} />
        <button className="btn-solid self-start" disabled={busy} onClick={upload}>{busy ? "Uploading…" : "Upload & read scores"}</button>
      </section>

      {loading && !data ? <Loading /> : data?.imports.length === 0 ? <Empty>No PDFs uploaded yet.</Empty> : (
        <ul className="flex flex-col gap-3">
          {data?.imports.map((i) => (
            <li key={i.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0"><b className="text-navy">{i.filename}</b><br /><span className="text-xs text-ink-soft">{tgl(i.createdAt)}{i.hasFile ? "" : " · original file deleted (retention period)"}</span></span>
                <span className="flex items-center gap-3"><span className={i.status === "analyzed" ? "badge-ok" : i.status === "verified" ? "badge-ok" : "badge-warn"}>{STATUS[i.status] ?? i.status}</span><button className="font-semibold text-brand" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? "Close" : "Open"}</button></span>
              </div>
              {open === i.id && <Panel item={i} onChanged={reload} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Panel({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const init = item.status === "extracted" || item.status === "uploaded" ? item.parsed : item.verified;
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map(([k]) => [k, init[k] != null ? String(init[k]) : ""])));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const det = useApi<Detail>(item.status === "analyzed" ? `/api/analytics/pdf/${item.id}` : null);
  const locked = item.status === "analyzed";

  const body = () => Object.fromEntries(FIELDS.filter(([k]) => v[k].trim() !== "").map(([k]) => [k, Number(v[k])]));
  async function verify() { setBusy(true); setErr(""); try { await api(`/api/analytics/pdf/${item.id}`, { method: "PATCH", json: body() }); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  async function analyze() {
    setBusy(true); setErr("");
    try {
      await api(`/api/analytics/pdf/${item.id}/analyze`, { json: {} });
      for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 1000)); const d = await api<Detail>(`/api/analytics/pdf/${item.id}`); if (d.analysis?.status === "ready" || d.analysis?.status === "failed") break; }
      onChanged(); det.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() { if (!confirm("Delete this PDF and its results?")) return; try { await api(`/api/analytics/pdf/${item.id}`, { method: "DELETE" }); onChanged(); } catch (e) { setErr((e as Error).message); } }

  const n = det.data?.analysis?.narrative;
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      {!locked && <p className="text-sm text-ink-soft">{Object.keys(item.parsed).length ? "The scores below were read automatically and may be wrong. Check and correct them before analyzing." : "No scores were read automatically. Enter the scores from your report."}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1.5 text-sm font-semibold text-navy">{label}
            <input className="field font-normal" inputMode="numeric" disabled={locked} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
        ))}
      </div>
      <ErrorNote text={err} />
      <div className="flex flex-wrap gap-2">
        {!locked && <button className="btn-outline" disabled={busy} onClick={verify}>{item.status === "verified" ? "Save correction" : "Confirm scores"}</button>}
        {item.status === "verified" && <button className="btn-solid" disabled={busy} onClick={analyze}>{busy ? "Analyzing…" : "Analyze now"}</button>}
        {item.hasFile && <a className="btn-outline" href={`/api/analytics/pdf/${item.id}/file`}>Download PDF</a>}
        <button className="btn-outline !text-red-700" onClick={remove}>Delete</button>
      </div>
      {locked && det.data?.analysis?.status === "ready" && n && (
        <div className="rounded-xl bg-canvas p-4 text-sm">
          <p className="font-semibold text-navy">{n.summary}</p>
          <p className="mt-2 text-ink-soft">{n.narrative}</p>
          {n.strengths.length > 0 && <p className="mt-2"><b className="text-navy">Strong:</b> {n.strengths.map((x) => x.topic).join(", ")}</p>}
          {n.weaknesses.length > 0 && <p><b className="text-navy">Needs strengthening:</b> {n.weaknesses.map((x) => x.topic).join(", ")}</p>}
          <ul className="mt-2 list-disc pl-5 text-ink-soft">{n.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-2 text-xs text-ink-soft">Analysis from PDF scores is limited to per-section scores. {det.data?.analysis?.engine === "template" ? "Basic automatic narrative." : ""}</p>
        </div>
      )}
      {locked && det.data?.analysis && det.data.analysis.status !== "ready" && <p className="text-sm text-ink-soft">{det.data.analysis.status === "failed" ? "Analysis failed. Click analyze again." : "Preparing the analysis…"}</p>}
    </div>
  );
}

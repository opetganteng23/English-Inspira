"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type A = { id: string; user: string; test: string; kind: string; finishedAt: string; scoreEst: number; flags: number; counts: Record<string, number>; review: { status: string; note?: string } | null };
const FLAG: Record<string, string> = { tab_hidden: "Pindah tab", fullscreen_exit: "Exit fullscreen", paste: "Paste", multi_tab: "Multi-tab" };
const RV: Record<string, [string, string]> = { clean: ["Bersih", "badge-ok"], suspicious: ["Mencurigakan", "badge-warn"], invalid: ["Invalid", "badge-bad"] };

export default function Proctoring() {
  const [filter, setFilter] = useState("pending");
  const { data, loading, error, reload } = useApi<{ attempts: A[] }>(`/api/admin/proctoring?filter=${filter}`);
  const [note, setNote] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  async function review(id: string, status: string) {
    setErr("");
    try { await api("/api/admin/proctoring", { method: "PATCH", json: { id, status, note: note[id] || undefined } }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Review Proctoring</h1><p className="text-sm text-ink-soft">Light monitoring: tab switches, leaving fullscreen, paste. No camera or microphone recording.</p></div>
        <div className="flex gap-1 rounded-lg bg-white p-1 text-sm" role="tablist">{([["pending", "Not reviewed"], ["all", "All"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-md px-3 py-1.5 font-semibold ${filter === k ? "bg-navy text-white" : "text-ink-soft"}`}>{l}</button>)}</div></div>
      <ErrorNote text={error || err} />
      {loading && !data ? <Loading /> : (
        <div className="flex flex-col gap-3">
          {data?.attempts.map((a) => (
            <div key={a.id} className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-navy">{a.user}</p><p className="text-sm text-ink-soft">{a.test} · {tgl(a.finishedAt, true)} · score {a.scoreEst}</p></div>{a.review && <span className={RV[a.review.status][1]}>{RV[a.review.status][0]}</span>}</div>
              <div className="flex flex-wrap gap-2">{Object.entries(a.counts).map(([k, n]) => <span key={k} className="badge-muted">{FLAG[k] ?? k}: {n}×</span>)}</div>
              <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Note" className="field" placeholder={a.review?.note || "Note (optional)"} value={note[a.id] ?? ""} onChange={(e) => setNote({ ...note, [a.id]: e.target.value })} />
                <div className="flex shrink-0 gap-2">{Object.entries(RV).map(([k, [l]]) => <button key={k} className={k === "clean" ? "btn-outline" : k === "suspicious" ? "btn-accent" : "btn-danger"} onClick={() => review(a.id, k)}>{l}</button>)}</div></div>
            </div>
          ))}
          {data?.attempts.length === 0 && <div className="card py-10 text-center text-ink-soft">No sessions with activity notes.</div>}
        </div>
      )}
    </div>
  );
}

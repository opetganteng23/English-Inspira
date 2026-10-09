"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote, Stat } from "@/components/Charts";

type T = { id: string; user: string; title: string; flagged: boolean; reviewed: boolean; helpful: boolean | null; messages: number; updatedAt: string; last: string };
type R = { stats: { conversations30d: number; helpfulPct: number | null; plans30d: number; needReview: number }; settings: { monthlyQuota: number }; ai: { enabled: boolean; model: string | null }; threads: T[] };
type D = { id: string; user: { name?: string; email?: string; targetScore?: number }; title: string; flagged: boolean; reviewed: boolean; reviewNote: string; helpful: boolean | null; messages: { role: string; content: string; at: string; mock?: boolean }[]; actionPlan: { text: string; done: boolean }[] };

export default function KonselorAdmin() {
  const [filter, setFilter] = useState("review");
  const { data, loading, error, reload } = useApi<R>(`/api/admin/counselor?filter=${filter}`);
  const [sel, setSel] = useState<string | null>(null);
  const [free, setFree] = useState<string>("");
  const [msg, setMsg] = useState("");

  async function saveQuota() {
    setMsg("");
    try { await api("/api/admin/params", { method: "PUT", json: { key: "counselor_quota", value: Number(free) } }); setMsg("Monthly quota saved."); reload(); }
    catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="page-title">Konselor AI</h1><p className="text-sm text-ink-soft">Review answer quality, set limits and quota.</p></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          <p className={`rounded-lg p-3 text-sm ${data.ai.enabled ? "bg-success-tint text-success" : "bg-accent-tint text-accent-dark"}`}>{data.ai.enabled ? `Connected to the Claude API (model ${data.ai.model}).` : "ANTHROPIC_API_KEY is not set: the Counselor uses a basic rule-based mode (automatic answers without AI)."}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="CONVERSATIONS (30 DAYS)" value={data.stats.conversations30d} />
            <Stat label="DINILAI MEMBANTU" value={data.stats.helpfulPct != null ? `${data.stats.helpfulPct}%` : "-"} />
            <Stat label="ACTION PLANS CREATED" value={data.stats.plans30d} />
            <Stat label="NEEDS REVIEW" value={data.stats.needReview} tone={data.stats.needReview ? "warn" : "ok"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Percakapan</h2>
                <div className="flex gap-1 rounded-lg bg-white p-1 text-sm" role="tablist">{([["review", "Needs review"], ["flagged", "Flagged"], ["all", "All"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-md px-3 py-1.5 font-semibold ${filter === k ? "bg-navy text-white" : "text-ink-soft"}`}>{l}</button>)}</div></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Participant</th><th>Percakapan</th><th>Messages</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.threads.map((t) => <tr key={t.id}><td className="font-semibold text-navy">{t.user}</td><td className="max-w-[260px]"><span className="block truncate">{t.title}</span><span className="block truncate text-xs text-ink-soft">{t.last}</span></td><td>{t.messages}</td>
                    <td className="space-x-1 whitespace-nowrap">{t.flagged && <span className="badge-bad">Flagged</span>}{t.helpful === false && <span className="badge-warn">👎</span>}{t.helpful === true && <span className="badge-ok">👍</span>}{t.reviewed && <span className="badge-muted">Reviewed</span>}</td>
                    <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(t.id)}>Buka</button></td></tr>)}
                  {data.threads.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No conversations in this filter.</td></tr>}
                </tbody>
              </table></div>
            </section>

            <aside className="flex flex-col gap-4">
              <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Counselor settings</h2>
                <p className="mt-2 text-sm text-ink-soft">Data read by the AI: section scores, per-question answers, time spent, test history, target score.</p>
                <p className="mt-2 text-sm text-ink-soft">Limits: no promises of scores or passing, no essay writing; signs of severe distress show professional help information and flag the conversation.</p>
                <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-navy">Messages per participant per month<input className="field font-normal" type="number" min={0} max={1000} value={free === "" ? data.settings.monthlyQuota : free} onChange={(e) => setFree(e.target.value)} /></label>
                <button className="btn-outline mt-3" onClick={saveQuota}>Save quota</button>{msg && <p role="status" className="mt-2 text-sm text-ink-soft">{msg}</p>}
                <p className="mt-3 text-xs text-ink-soft">This quota is also in System Parameters (counselor_quota).</p></section>
            </aside>
          </div>
        </>
      )}
      {sel && <ThreadModal id={sel} onClose={() => setSel(null)} onChanged={reload} />}
    </div>
  );
}

function ThreadModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data: d, error, reload } = useApi<D>(`/api/admin/counselor/${id}`);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState("");
  async function patch(body: object) { setErr(""); try { await api(`/api/admin/counselor/${id}`, { method: "PATCH", json: body }); reload(); onChanged(); } catch (e) { setErr((e as Error).message); } }
  return (
    <Modal title="Review conversation" onClose={onClose} wide>
      {!d ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-ink-soft">{d.user.name ?? d.user.email} · target {d.user.targetScore ?? "-"} <span className="text-xs">(admin access is recorded in the audit log)</span></p>
          <ErrorNote text={err} />
          <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto rounded-xl bg-canvas p-3">
            {d.messages.map((m, i) => <div key={i} className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 ${m.role === "user" ? "self-end bg-brand text-white" : "self-start border border-line bg-white"}`}>{m.role === "assistant" && <b className="block text-xs text-brand">AI{m.mock ? " (mode dasar)" : ""}</b>}{m.content}</div>)}
          </div>
          {d.actionPlan.length > 0 && <div><b className="text-navy">Action plan</b><ul className="mt-1 list-disc pl-5">{d.actionPlan.map((p, i) => <li key={i} className={p.done ? "line-through" : ""}>{p.text}</li>)}</ul></div>}
          <label className="flex flex-col gap-1.5 font-semibold text-navy">Review notes<textarea className="field" rows={2} value={note ?? d.reviewNote} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-solid" onClick={() => patch({ reviewed: true, reviewNote: note ?? d.reviewNote })}>Mark as reviewed</button>
            <button className="btn-outline" onClick={() => patch({ flagged: !d.flagged })}>{d.flagged ? "Remove flag" : "Flag bad answer"}</button>
          </div>
          <p className="text-xs text-ink-soft">To limit topics or add examples of good answers, change the rules in lib/ai.ts and deploy. Reviews here are used to improve the prompt.</p>
        </div>
      )}
    </Modal>
  );
}

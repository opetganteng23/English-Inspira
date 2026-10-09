"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type T = { id: string; user: string; title: string; flagged: boolean; reviewed: boolean; helpful: boolean | null; messages: number; updatedAt: string; last: string };
type D = { id: string; user: string; title: string; flagged: boolean; reviewed: boolean; reviewNote: string; messages: { role: string; content: string; at: string }[] };

export default function KonselorCoach() {
  const [filter, setFilter] = useState("review");
  const { data, loading, error, reload } = useApi<{ threads: T[] }>(`/api/coach/counselor?filter=${filter}`);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Tinjauan Konselor AI</h1><p className="text-sm text-ink-soft">Your institution’s participants’ conversations with the AI Counselor. Flag bad answers so the admin can improve them. Opening a conversation is recorded.</p></div>
      <div className="flex gap-1 self-start rounded-lg bg-white p-1 text-sm" role="tablist">{[["review", "Needs review"], ["flagged", "Flagged"], ["all", "All"]].map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-md px-3 py-1.5 font-semibold ${filter === k ? "bg-navy text-white" : "text-ink-soft"}`}>{l}</button>)}</div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : data?.threads.length === 0 ? <Empty>No conversations for this filter.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Participant</th><th>Last</th><th>Status</th><th /></tr></thead>
          <tbody>{data?.threads.map((t) => (
            <tr key={t.id}><td className="font-semibold text-navy">{t.user}<br /><span className="text-xs font-normal text-ink-soft">{t.title}</span></td><td className="max-w-xs truncate">{t.last}<br /><span className="text-xs text-ink-soft">{tgl(t.updatedAt, true)} · {t.messages} pesan</span></td>
              <td>{t.flagged && <span className="badge-bad mr-1">flagged</span>}{t.helpful === false && <span className="badge-warn mr-1">not helpful</span>}{t.reviewed && <span className="badge-ok">reviewed</span>}</td>
              <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(t.id)}>Buka</button></td></tr>
          ))}</tbody>
        </table></div>
      )}
      {sel && <Detail id={sel} onClose={() => { setSel(null); reload(); }} />}
    </div>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: d, error, reload } = useApi<D>(`/api/coach/counselor/${id}`);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const patch = async (body: object) => { setErr(""); try { await api(`/api/coach/counselor/${id}`, { method: "PATCH", json: body }); reload(); } catch (e) { setErr((e as Error).message); } };
  return (
    <Modal title="Participant conversation" onClose={onClose} wide>
      {!d ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-ink-soft">{d.user} · {d.title}</p>
          <ul className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">{d.messages.map((m, i) => <li key={i} className={`rounded-xl p-3 ${m.role === "user" ? "bg-brand-tint" : "bg-canvas"}`}><b className="text-navy">{m.role === "user" ? "Participant" : "Konselor AI"}</b><p className="mt-1 whitespace-pre-wrap">{m.content}</p></li>)}</ul>
          <ErrorNote text={err} />
          <label className="flex flex-col gap-1.5 font-semibold text-navy">Review notes<textarea className="field h-16 py-2 font-normal" value={note || d.reviewNote} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><button className={d.flagged ? "btn-solid" : "btn-outline"} onClick={() => patch({ flagged: !d.flagged, reviewNote: note || d.reviewNote })}>{d.flagged ? "Remove flag" : "Flag bad answer"}</button><button className="btn-solid" onClick={() => patch({ reviewed: true, reviewNote: note || d.reviewNote })}>Mark as reviewed</button></div>
        </div>
      )}
    </Modal>
  );
}

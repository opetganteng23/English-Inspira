"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type Msg = { from: "user" | "staff"; byName: string | null; body: string; at: string };
type T = { id: string; number: number; category: string; status: string; statusLabel: string; urgent: boolean; createdAt: string; messages: Msg[]; whatsapp: { number: string; afterMin: number } | null };
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Satu permintaan: percakapan dengan tim, balas, dan WhatsApp hanya bila urgent belum dibalas (8.7). */
export default function Request({ params }: { params: { id: string } }) {
  const token = useSearchParams().get("t");
  const q = token ? `?t=${encodeURIComponent(token)}` : "";
  const { data, error, reload } = useApi<T>(`/api/support/${params.id}${q}`);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send() {
    setBusy(true); setErr("");
    try { await api(`/api/support/${params.id}${q}`, { json: { body: reply }, silent: true }); setReply(""); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  if (!data) return error ? <ErrorNote text={error} /> : <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wider text-brand">REQUEST #{data.number}</p>
        <h1 className="page-title">{data.category}</h1>
        <p className="text-sm text-ink-soft">{data.statusLabel} · sent {when(data.createdAt)} WIB</p>
      </div>
      {data.whatsapp && (
        <div className="rounded-xl border border-accent bg-accent-tint p-3 text-sm text-navy">
          No reply yet after {data.whatsapp.afterMin} minutes on an urgent problem. If you are in the middle of a test, you can also reach us on WhatsApp. Mention request <b>#{data.number}</b>.
          <a className="btn-solid mt-2 block w-fit" target="_blank" rel="noopener" href={`https://wa.me/${data.whatsapp.number}?text=${encodeURIComponent(`Request #${data.number}`)}`}>Open WhatsApp</a>
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {data.messages.map((m, i) => (
          <li key={i} className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.from === "staff" ? "self-start bg-white ring-1 ring-line" : "self-end bg-brand-tint"}`}>
            <p className="mb-1 text-xs font-semibold text-ink-soft">{m.from === "staff" ? `${m.byName} · Support` : "You"} · {when(m.at)}</p>
            <p className="whitespace-pre-line text-ink">{m.body}</p>
          </li>
        ))}
      </ol>
      <section className="card flex flex-col gap-2">
        <label className="text-sm font-semibold text-navy" htmlFor="reply">{data.status === "resolved" ? "Still a problem? Reply to reopen" : "Reply"}</label>
        <textarea id="reply" className="field h-24" maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} />
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <button className="btn-solid self-start" disabled={busy || !reply.trim()} onClick={send}>{busy ? "Sending…" : "Send"}</button>
      </section>
    </div>
  );
}

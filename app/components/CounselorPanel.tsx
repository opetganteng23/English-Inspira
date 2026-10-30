"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";

type Msg = { role: "user" | "assistant"; content: string };
type Access = { allowed: boolean; remaining: number; quota: number; reason: string | null };

const STARTERS = ["Where should I start?", "How long until I reach my target?", "Am I ready to register for the official EPTA test?"];

/** Konselor AI di dalam halaman hasil: satu percakapan per hasil tes, memakai API konselor yang sama dengan halaman /counselor. */
/** Panel hanya tampil bila admin menyalakan AI Counselor (Settings → Features). */
export function CounselorPanel({ attemptId }: { attemptId: string }) {
  const f = useApi<{ aiCounselor: boolean }>("/api/features");
  return f.data?.aiCounselor ? <CounselorChat attemptId={attemptId} /> : null;
}

function CounselorChat({ attemptId }: { attemptId: string }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [access, setAccess] = useState<Access | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const c = await api("/api/counselor/threads", { json: { attemptId } });
        const t = await api(`/api/counselor/threads/${c.id}`);
        if (stop) return;
        setThreadId(c.id); setMsgs(t.messages ?? []); setAccess(t.access);
      } catch (e) { if (!stop) setErr((e as Error).message); }
    })();
    return () => { stop = true; };
  }, [attemptId]);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, sending]);

  async function send(content: string) {
    if (!threadId || !content.trim() || sending) return;
    setSending(true); setErr(""); setText("");
    setMsgs((m) => [...m, { role: "user", content }]);
    try {
      const r = await api(`/api/counselor/threads/${threadId}/messages`, { json: { content } });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply }]); setAccess(r.access);
    } catch (e) { setErr((e as Error).message); setText(content); setMsgs((m) => m.slice(0, -1)); }
    finally { setSending(false); }
  }

  const blocked = access && !access.allowed;
  return (
    <section className="flex min-h-[340px] flex-col overflow-hidden rounded-2xl border-[1.5px] border-success/60 bg-white" aria-label="AI Counselor">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-success-tint px-4 py-3">
        <h2 className="font-display text-base font-extrabold text-navy">Ask the AI Counselor about your result</h2>
        {access && <span className="text-xs font-semibold text-success">{access.remaining} questions left this month</span>}
      </div>
      <p className="bg-brand-tint px-4 py-2 text-xs text-navy">The AI Counselor only answers questions about learning English and the English Inspira program. Other topics will not be answered.</p>
      <div ref={box} className="flex max-h-[320px] min-h-[160px] flex-1 flex-col gap-2.5 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && !err && <p className="rounded-xl bg-canvas p-3 text-sm text-ink">Hi! I have read this result and all your answers. What would you like to know?</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "self-end bg-brand text-white" : "self-start border border-line bg-canvas text-ink"}`}>{m.content}</div>
        ))}
        {sending && <div className="self-start rounded-2xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink-soft" role="status">Typing…</div>}
      </div>
      {err && <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {msgs.length === 0 && !blocked && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {STARTERS.map((s) => <button key={s} disabled={!threadId || sending} onClick={() => send(s)} className="rounded-full border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint disabled:opacity-50">{s}</button>)}
        </div>
      )}
      {blocked ? <p className="border-t border-line p-4 text-sm text-ink-soft">{access?.reason}</p> : (
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t border-line p-3">
          <label className="sr-only" htmlFor="result-msg">Type a question</label>
          <textarea id="result-msg" rows={1} maxLength={1500} className="field max-h-28 min-h-[44px] flex-1 resize-none !h-11" placeholder="Type a question…" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
          <button className="btn-solid shrink-0" disabled={sending || !threadId || !text.trim()}>Send</button>
        </form>
      )}
      <p className="px-4 pb-3 text-[11px] leading-snug text-ink-soft">The AI Counselor can make mistakes; double-check official requirements. <Link href={threadId ? `/counselor?thread=${threadId}` : "/counselor"} className="font-semibold text-brand">Open full conversation</Link></p>
    </section>
  );
}

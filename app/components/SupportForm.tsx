"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";

export const CATEGORIES: [string, string][] = [
  ["account", "Account or sign-in"], ["schedule", "Test schedule"], ["during_test", "Problem during the test"], ["audio", "Audio does not play"], ["other", "Something else"],
];

type Msg = { role: "user" | "assistant"; content: string };
type Assist = { faq: { question: string; answer: string }[]; answer: string; needsHuman: boolean };
/** AI menjawab tapi belum menolong sebanyak ini: langsung diteruskan ke tim (8.8). */
const MAX_FAILS = 2;

/**
 * Form tiket (8.2): nama, email, kategori, kendala wajib. Untuk pengguna yang login, nama dan email diambil dari akun.
 * Bila "AI help before a ticket" menyala (8.8): saran FAQ dulu (tanpa AI), lalu AI dari FAQ; tiket dikirim dengan percakapannya.
 */
export function SupportForm({ signedIn, compact, onSent, defaultCategory = "", stayHere }: { signedIn: boolean; compact?: boolean; onSent?: (t: { id: string; number: number }) => void; defaultCategory?: string; stayHere?: boolean }) {
  const [v, setV] = useState({ name: "", email: "", category: defaultCategory, body: "", website: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; number: number; token: string | null } | null>(null);
  const [solved, setSolved] = useState(false);
  const cfg = useApi<{ enabled: boolean; maxTurns: number }>("/api/support/assist").data;
  const [history, setHistory] = useState<Msg[] | null>(null); // null = belum ditawari bantuan
  const [faq, setFaq] = useState<Assist["faq"]>([]);
  const [handoff, setHandoff] = useState(false);
  const [follow, setFollow] = useState("");
  const aiTurns = history?.filter((m) => m.role === "assistant").length ?? 0;

  async function assist(h: Msg[], useAi: boolean) {
    const r = await api<Assist>("/api/support/assist", { json: { category: v.category, history: h, useAi }, silent: true });
    if (r.faq.length) setFaq(r.faq);
    if (!useAi) { if (!r.faq.length) return assist(h, true); setHistory(h); return; }
    const next = r.answer ? [...h, { role: "assistant" as const, content: r.answer }] : h;
    setHistory(next);
    if (r.needsHuman || next.filter((m) => m.role === "assistant").length > MAX_FAILS) setHandoff(true);
  }

  async function ticket() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ id: string; number: number; token: string | null }>("/api/support", { json: { ...v, page: window.location.pathname, assist: history && history.length > 1 ? history : undefined }, silent: true });
      setDone(r); onSent?.(r);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.category) return setErr("Choose what the problem is about");
    if (!cfg?.enabled || history) return ticket();
    setBusy(true); setErr("");
    try { await assist([{ role: "user", content: v.body }], false); }
    catch { setHistory([{ role: "user", content: v.body }]); setHandoff(true); } // bantuan gagal: langsung ke tim
    finally { setBusy(false); }
  }

  async function askAi(text?: string) {
    if (!history) return;
    const h = text ? [...history, { role: "user" as const, content: text }] : history;
    setBusy(true); setErr("");
    try { await assist(h, true); setFollow(""); } catch { setHandoff(true); } finally { setBusy(false); }
  }

  if (done) return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-success-tint p-4 text-sm text-navy">
      <b>Request #{done.number} sent.</b>
      <span>We reply here and by email. {signedIn ? "" : "Check your inbox for the link to follow this request."}</span>
      {stayHere ? <span>Continue your test; you can follow the reply in Help &amp; support after you finish.</span>
        : <Link href={`/support/${done.id}${done.token ? `?t=${done.token}` : ""}`} className="font-semibold text-brand">View your request →</Link>}
    </div>
  );
  if (solved) return <div role="status" className="rounded-xl bg-success-tint p-4 text-sm text-navy"><b>Glad it is solved.</b> No request was sent.</div>;

  if (history) {
    const answers = history.filter((m) => m.role === "assistant");
    const canAsk = !handoff && aiTurns <= MAX_FAILS && history.filter((m) => m.role === "user").length < (cfg?.maxTurns ?? 3);
    return (
      <div className="flex flex-col gap-3" aria-live="polite">
        {faq.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-navy">These answers may help:</p>
            {faq.map((f) => <details key={f.question} className="rounded-xl bg-canvas p-3 text-sm" open={faq.length === 1}><summary className="cursor-pointer font-semibold text-navy">{f.question}</summary><p className="mt-1 text-ink-soft">{f.answer}</p></details>)}
          </div>
        )}
        {answers.map((m, i) => <div key={i} className="rounded-xl bg-brand-tint p-3 text-sm"><p className="mb-1 text-xs font-semibold text-ink-soft">AI help · based on our FAQ</p><p className="whitespace-pre-line text-ink">{m.content}</p></div>)}
        {handoff && <p className="text-sm text-navy">This needs our team. Send the request and we will take it from here; the steps above are included.</p>}
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" disabled={busy} onClick={() => setSolved(true)}>It is solved</button>
          {canAsk && answers.length === 0 && <button className="btn-outline" disabled={busy} onClick={() => askAi()}>{busy ? "Thinking…" : "Not solved, suggest a fix"}</button>}
          <button className="btn-solid" disabled={busy} onClick={ticket}>{busy && handoff ? "Sending…" : "Send to our team"}</button>
        </div>
        {canAsk && answers.length > 0 && (
          <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (follow.trim()) void askAi(follow.trim()); }}>
            <label className="text-sm font-semibold text-navy" htmlFor="follow">Still not working? Tell us what happened when you tried</label>
            <textarea id="follow" className="field h-20" maxLength={2000} value={follow} onChange={(e) => setFollow(e.target.value)} />
            <button className="btn-outline self-start" disabled={busy || !follow.trim()}>{busy ? "Thinking…" : "Ask again"}</button>
          </form>
        )}
      </div>
    );
  }

  const label = "flex flex-col gap-1 text-sm font-semibold text-navy";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!signedIn && (
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          <label className={label}>Your name<input required className="field font-normal" value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" /></label>
          <label className={label}>Email<input required type="email" className="field font-normal" value={v.email} maxLength={200} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" /></label>
        </div>
      )}
      <label className={label}>What is it about?
        <select required className="field font-normal" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
          <option value="">Choose…</option>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className={label}>Describe the problem
        <textarea required minLength={10} maxLength={2000} className="field h-28 font-normal" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What happened, on which page, and what you already tried. A screenshot description helps." />
      </label>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} />
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button className="btn-solid self-start" disabled={busy}>{busy ? (cfg?.enabled ? "Checking…" : "Sending…") : cfg?.enabled ? "Continue" : "Send request"}</button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";

export const CATEGORIES: [string, string][] = [
  ["account", "Account or sign-in"], ["schedule", "Test schedule"], ["during_test", "Problem during the test"], ["audio", "Audio does not play"], ["other", "Something else"],
];

/** Form tiket (8.2): nama, email, kategori, kendala wajib. Untuk pengguna yang login, nama dan email diambil dari akun. */
export function SupportForm({ signedIn, compact, onSent }: { signedIn: boolean; compact?: boolean; onSent?: (t: { id: string; number: number }) => void }) {
  const [v, setV] = useState({ name: "", email: "", category: "", body: "", website: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; number: number; token: string | null } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!v.category) return setErr("Choose what the problem is about");
    setBusy(true); setErr("");
    try {
      const r = await api<{ id: string; number: number; token: string | null }>("/api/support", { json: { ...v, page: window.location.pathname }, silent: true });
      setDone(r); onSent?.(r);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  if (done) return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-success-tint p-4 text-sm text-navy">
      <b>Request #{done.number} sent.</b>
      <span>We reply here and by email. {signedIn ? "" : "Check your inbox for the link to follow this request."}</span>
      <Link href={`/support/${done.id}${done.token ? `?t=${done.token}` : ""}`} className="font-semibold text-brand">View your request →</Link>
    </div>
  );

  const label = "flex flex-col gap-1 text-sm font-semibold text-navy";
  return (
    <form onSubmit={send} className="flex flex-col gap-3">
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
        <textarea required minLength={10} maxLength={4000} className="field h-28 font-normal" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What happened, on which page, and what you already tried. A screenshot description helps." />
      </label>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} />
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button className="btn-solid self-start" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/** Set atau ganti password. Login dengan kode email tetap bisa dipakai. */
export function PasswordCard({ email, hasPassword, onDone }: { email: string; hasPassword: boolean; onDone?: () => void }) {
  const [f, setF] = useState({ current: "", password: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (f.password !== f.confirm) { setMsg({ ok: false, text: "The new passwords do not match" }); return; }
    setBusy(true);
    try {
      await api("/api/me/password", { json: { ...(hasPassword ? { current: f.current } : {}), password: f.password } });
      setF({ current: "", password: "", confirm: "" }); setMsg({ ok: true, text: hasPassword ? "Password changed." : "Password set. You can now sign in with it." }); onDone?.();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-display text-lg font-extrabold text-navy">Sign-in & security</h2>
      <p className="text-sm text-ink-soft">You sign in as <b>{email}</b> with a password or a 6-digit code sent to that email. {hasPassword ? "Change your password below." : "You have not set a password yet."} Email changes are handled by the admin.</p>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        {hasPassword && <label className={`${label} sm:col-span-2`}>Current password<input className="field font-normal" type="password" required autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></label>}
        <label className={label}>New password<input className="field font-normal" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label className={label}>Confirm new password<input className="field font-normal" type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></label>
        {msg && <p role="status" className={`text-sm sm:col-span-2 ${msg.ok ? "text-success" : "text-red-700"}`}>{msg.text}</p>}
        <button className="btn-solid self-start sm:col-span-2" disabled={busy}>{busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button>
      </form>
    </section>
  );
}

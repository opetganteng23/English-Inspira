"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { uploadImage } from "@/lib/compress-image";

const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

/** Foto profil: bulat, dengan unggah, ganti, dan hapus. Tersimpan sebagai aset pribadi (hanya pemilik dan admin). */
export function AvatarEditor({ initial, avatarId, onChanged }: { initial: string; avatarId: string | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const a = await uploadImage(file, { sensitive: true, maxSide: 512, maxBytes: 150 * 1024 });
      await api("/api/me", { method: "PATCH", json: { avatarAssetId: a.id } });
      onChanged();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() { setBusy(true); setErr(""); try { await api("/api/me", { method: "PATCH", json: { avatarAssetId: null } }); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return (
    <div className="flex items-center gap-4">
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy font-display text-2xl font-extrabold text-white">
        {avatarId
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/assets/${avatarId}`} alt="Your profile photo" className="h-full w-full object-cover" />
          : initial}
      </span>
      <div className="flex flex-col gap-1">
        <span className="flex flex-wrap gap-3 text-sm font-semibold">
          <label className="cursor-pointer text-brand">{busy ? "Uploading…" : avatarId ? "Change photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} /></label>
          {avatarId && <button type="button" className="text-red-700" disabled={busy} onClick={remove}>Remove</button>}
        </span>
        {err && <span role="alert" className="text-xs text-red-700">{err}</span>}
      </div>
    </div>
  );
}

/** Ganti email dua langkah: kode 6 digit dikirim ke alamat baru, lalu dikonfirmasi. */
export function EmailChangeCard({ email, locked, onChanged }: { email: string; locked?: boolean; onChanged: () => void }) {
  const [step, setStep] = useState<"idle" | "new" | "code">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true); setErr("");
    try { await api("/api/me/email", { json: { newEmail } }); setStep("code"); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setErr("");
    try { await api("/api/me/email", { method: "PUT", json: { newEmail, code } }); setOk(`Email changed to ${newEmail}.`); setStep("idle"); setCode(""); setNewEmail(""); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-display text-lg font-extrabold text-navy">Email</h2>
      <p className="text-sm text-ink-soft">Your sign-in email: <b className="text-navy">{email}</b></p>
      {ok && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{ok}</p>}
      {step === "idle" && <button type="button" className="btn-outline self-start" disabled={locked} onClick={() => { setStep("new"); setOk(""); }}>Change email</button>}
      {locked && <p className="text-xs text-ink-soft">Email cannot be changed while an official EPTA registration is active.</p>}
      {step === "new" && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label className={label}>New email<input className="field font-normal" type="email" required autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></label>
          <p className="text-xs text-ink-soft">We send a 6-digit code to the new address. Your current email stays active until you confirm.</p>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          <div className="flex gap-2"><button className="btn-solid" disabled={busy || !newEmail}>{busy ? "Sending…" : "Send code"}</button><button type="button" className="btn-outline" onClick={() => { setStep("idle"); setErr(""); }}>Cancel</button></div>
        </form>
      )}
      {step === "code" && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); confirm(); }}>
          <label className={label}>Code sent to {newEmail}<input className="field font-normal tracking-[6px]" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          <div className="flex gap-2"><button className="btn-solid" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm"}</button><button type="button" className="btn-outline" onClick={() => { setStep("new"); setErr(""); setCode(""); }}>Use another email</button></div>
        </form>
      )}
    </section>
  );
}

/** Preferensi email opsional. Email akun dan keamanan (kode masuk, reset, jadwal coaching, pendaftaran ITP) selalu dikirim. */
export function NotificationPrefs({ prefs, onChanged }: { prefs: { reminders: boolean; progress: boolean }; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function set(k: "reminders" | "progress", v: boolean) {
    setBusy(true); setErr("");
    try { await api("/api/me", { method: "PATCH", json: { emailPrefs: { [k]: v } } }); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const row = (k: "reminders" | "progress", title: string, desc: string) => (
    <label className="flex min-h-[48px] cursor-pointer items-start justify-between gap-4 py-2">
      <span><span className="block text-sm font-semibold text-navy">{title}</span><span className="block text-xs text-ink-soft">{desc}</span></span>
      <input type="checkbox" role="switch" className="mt-1 h-6 w-11 shrink-0 cursor-pointer accent-[#0B4FA6]" checked={prefs[k]} disabled={busy} onChange={(e) => set(k, e.target.checked)} aria-label={title} />
    </label>
  );
  return (
    <section className="card">
      <h2 className="font-display text-lg font-extrabold text-navy">Email notifications</h2>
      <div className="mt-1 divide-y divide-line">
        {row("reminders", "Reminders", "Study plan deadlines, low coaching quota, and tomorrow's coaching session.")}
        {row("progress", "Progress updates", "Placement result, level-ups, and when an analysis is ready.")}
      </div>
      <p className="mt-2 text-xs text-ink-soft">Sign-in codes, password resets, coaching schedule changes, and official test registration emails are always sent.</p>
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { LandingSettingsForm } from "@/components/LandingSettingsForm";
import { AppearanceSettings } from "@/components/AppearanceSettings";

/** Saklar fitur: fitur yang dimatikan hilang dari menu, halaman, dan API untuk semua peran. */
const FEATURES: [string, string, string][] = [
  ["learning", "Learning", "Courses, units, quizzes, and materials. Also turn it on per institution (Institution → Settings → Modules)."],
  ["coaching", "Coaching", "Coach slots, bookings, and attendance. Also turn it on per institution."],
  ["aiCounselor", "AI Counselor", "Participants ask study questions to the AI; coaches and admins review the conversations."],
  ["officialTest", "Official EPTA Test", "Registration for official test sessions with document checks."],
  ["certificates", "Certificates", "Certificates from official scores."],
  ["externalResults", "Class / external results", "Upload class or external test results and match them to participants."],
  ["programCycles", "Program cycles", "Program periods that open and close learning and placement."],
  ["aiSupport", "AI help before a ticket", "Before a help request is sent, matching FAQ answers are shown and, if needed, the AI suggests fixes from the FAQ only (no access to scores). The conversation is attached to the ticket."],
];

type Backup = { available: boolean; count: number; last: { name: string; size: number; at: string } | null; ageHours: number | null; ok: boolean };

/** Status backup harian DB (Sesi 7.3). Dibuat oleh script di server; di sini hanya dibaca. */
function BackupStatus() {
  const { data } = useApi<Backup>("/api/admin/backup-status");
  if (!data) return null;
  const age = data.ageHours == null ? null : data.ageHours < 48 ? `${Math.round(data.ageHours)} hours ago` : `${Math.round(data.ageHours / 24)} days ago`;
  return (
    <section className={`card flex flex-col gap-1 border-l-4 ${data.ok ? "border-l-success" : "border-l-red-600"}`}>
      <h2 className="font-display text-lg font-extrabold text-navy">Database backup</h2>
      {!data.available ? <p className="text-sm text-red-700">The backup folder cannot be read on this server.</p>
        : !data.last ? <p className="text-sm text-red-700">No backup found. Ask the server admin to check the daily backup job.</p>
        : <p className="text-sm">{data.ok ? "OK." : <b className="text-red-700">The last backup is older than a day. The daily backup job may not be running.</b>} Last backup {age} ({new Date(data.last.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB), {(data.last.size / 1_048_576).toFixed(0)} MB. {data.count} copies kept on the server.</p>}
      <p className="text-xs text-ink-soft">Backups are kept on the same server only. A copy outside the server is not set up yet.</p>
    </section>
  );
}

function FeatureSwitches() {
  const { data, reload } = useApi<Record<string, boolean>>("/api/admin/settings/features");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function toggle(k: string, on: boolean) {
    setBusy(true); setErr("");
    try { await api("/api/admin/settings/features", { method: "PUT", json: { ...data, [k]: on } }); reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-display text-lg font-extrabold text-navy">Features</h2>
      <p className="text-sm text-ink-soft">Tests, results, reports, and monitoring are always on. A feature that is turned off disappears from menus and pages for every role. Its data is kept, and you can turn it back on any time.</p>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {FEATURES.map(([k, t, d]) => (
          <label key={k} className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" disabled={!data || busy} checked={!!data?.[k]} onChange={(e) => toggle(k, e.target.checked)} /><span><b className="text-navy">{t}</b><br /><span className="text-ink-soft">{d}</span></span></label>
        ))}
      </div>
    </section>
  );
}

type G = { siteName: string; supportEmail: string; supportWhatsapp: string; itpOrganizer: string; refundPolicy: string; rescheduleDays: number; idRetentionDays: number };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Pengaturan() {
  const { data, loading, error, reload } = useApi<G>("/api/admin/settings/general");
  const [v, setV] = useState<G | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setV(data); }, [data]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!v) return;
    setBusy(true); setMsg(null);
    try { await api("/api/admin/settings/general", { method: "PUT", json: { ...v, rescheduleDays: Number(v.rescheduleDays), idRetentionDays: Number(v.idRetentionDays) } }); setMsg({ ok: true, text: "Settings saved." }); reload(); }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }
  if (loading && !v) return <Loading />;
  if (!v) return <ErrorNote text={error} />;
  const set = <K extends keyof G>(k: K, val: G[K]) => setV({ ...v, [k]: val });
  return (
    <div className="page-cols">
      <div><h1 className="page-title">Settings</h1><p className="text-sm text-ink-soft">Help contacts and official test information. Level and quota numbers are in System Parameters.</p></div>
      <BackupStatus />
      <FeatureSwitches />
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <form onSubmit={save} className="card flex flex-col gap-4">
        <label className={label}>Product name<input className="field font-normal" value={v.siteName} onChange={(e) => set("siteName", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Support email<input className="field font-normal" type="email" value={v.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></label>
          <label className={label}>Support WhatsApp<input className="field font-normal" inputMode="tel" value={v.supportWhatsapp} onChange={(e) => set("supportWhatsapp", e.target.value)} placeholder="6281234567890" /></label>
        </div>
        <label className={label}>Official test partner name<input className="field font-normal" value={v.itpOrganizer} onChange={(e) => set("itpOrganizer", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Official test reschedule limit (days before the test)<input className="field font-normal" type="number" min={0} max={60} value={v.rescheduleDays} onChange={(e) => set("rescheduleDays", Number(e.target.value))} /></label>
          <label className={label}>Identity document retention (days)<input className="field font-normal" type="number" min={1} value={v.idRetentionDays} onChange={(e) => set("idRetentionDays", Number(e.target.value))} /></label>
        </div>
        <label className={label}>Official test reschedule policy text (optional)<textarea className="field font-normal" rows={4} value={v.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)} placeholder="Leave empty to use the default text." /></label>
        <button className="btn-solid self-start" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
      </form>
      <AppearanceSettings />
      <LandingSettingsForm />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { applyPrefs } from "./UiPrefs";

type P = {
  theme: "system" | "light" | "dark"; fontSize: 16 | 18 | 20 | 22; reduceMotion: boolean; timerDefault: "shown" | "hidden";
  breakReminder: boolean; breakMin: 30 | 45 | 60 | 90; reminderDigest: "daily" | "weekly" | "important_only"; quietStart: string; quietEnd: string;
};
const DEFAULTS: P = { theme: "system", fontSize: 18, reduceMotion: false, timerDefault: "shown", breakReminder: true, breakMin: 45, reminderDigest: "daily", quietStart: "21:00", quietEnd: "07:00" };

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-full bg-surface-2 p-1">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`min-h-[36px] rounded-full px-3.5 text-sm font-medium transition-colors ${value === v ? "bg-surface text-brand shadow-sm" : "text-ink-soft hover:text-ink"}`}>{l}</button>
      ))}
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-calm" : "bg-line-strong"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}
const Row = ({ title, help, children }: { title: string; help: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="max-w-md"><p className="font-semibold text-ink">{title}</p><p className="text-sm text-ink-soft">{help}</p></div>
    {children}
  </div>
);

/** Pengaturan kenyamanan (MTS v2.4 §27.2 prinsip 5, §27.8 uiPrefs). Perubahan langsung berlaku dan tersimpan otomatis. */
export function ComfortSettings() {
  const [p, setP] = useState<P | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { api<P>("/api/me/ui-prefs").then(setP).catch(() => setP(DEFAULTS)); }, []);

  function update(patch: Partial<P>) {
    if (!p) return;
    const next = { ...p, ...patch };
    setP(next); applyPrefs(next); setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await api("/api/me/ui-prefs", { method: "PATCH", json: patch === DEFAULTS ? DEFAULTS : next }); setStatus("Saved"); }
      catch (x) { setStatus((x as Error).message); }
    }, 400);
  }

  if (!p) return <div className="card h-40 animate-pulse" aria-label="Loading settings" />;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="comfort-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 id="comfort-h" className="font-display text-xl font-semibold text-ink">Comfort settings</h2>
          <p className="text-sm text-ink-soft">Set up the app so it feels comfortable for you. Changes apply right away and save automatically.</p></div>
        <span role="status" className="text-sm text-ink-soft">{status}</span>
      </div>
      <div className="flex flex-col gap-4">
        <aside className="card" aria-label="Preview">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">Preview</h3>
          <p className="prose-ei !mb-3 text-ink">Coral reefs cover less than one percent of the ocean floor, yet they are home to a large share of all marine species.</p>
          <div className="flex items-center gap-2 rounded-lg border-2 border-brand bg-brand-tint p-2.5 text-sm text-ink"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-primary">B</span>A selected answer looks like this.</div>
          <div className="mt-3 flex flex-wrap gap-1.5"><span className="badge-ok">Strong</span><span className="badge bg-blue-soft text-blue">On track</span><span className="badge-warn">Needs practice</span></div>
        </aside>
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="mb-3 font-semibold text-ink">Look and feel</h3>
            <Row title="Theme" help="Follows your device by default. Dark mode is easier on the eyes at night.">
              <Segmented label="Theme" value={p.theme} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={(v) => update({ theme: v })} />
            </Row>
            <Row title="Text size for reading" help="Used in materials and passages. The line length stays comfortable at every size.">
              <label className="flex items-center gap-3 text-sm text-ink-soft">
                <input type="range" min={16} max={22} step={2} value={p.fontSize} aria-label="Text size" className="w-40 accent-[var(--primary)]"
                  onChange={(e) => update({ fontSize: Number(e.target.value) as P["fontSize"] })} />
                <span className="w-12 text-right font-medium text-ink">{p.fontSize} px</span>
              </label>
            </Row>
            <Row title="Reduce motion" help="Turns off animations that are not needed to understand what changed.">
              <Toggle label="Reduce motion" checked={p.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
            </Row>
          </div>
          <div className="card">
            <h3 className="mb-3 font-semibold text-ink">During tests</h3>
            <Row title="Timer" help="If hidden, it still appears when 5 minutes and 1 minute are left. The real time is always kept by the server.">
              <Segmented label="Timer" value={p.timerDefault} options={[["shown", "Shown"], ["hidden", "Hidden"]]} onChange={(v) => update({ timerDefault: v })} />
            </Row>
          </div>
          <div className="card">
            <h3 className="mb-3 font-semibold text-ink">While you study</h3>
            <Row title="Break reminders" help="A small card, never during a test. You can always choose to keep going.">
              <Toggle label="Break reminders" checked={p.breakReminder} onChange={(v) => update({ breakReminder: v })} />
            </Row>
            <Row title="Remind me after" help="Minutes of active learning.">
              <select className="field !h-11 !w-32" value={p.breakMin} disabled={!p.breakReminder} aria-label="Remind me after"
                onChange={(e) => update({ breakMin: Number(e.target.value) as P["breakMin"] })}>
                {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </Row>
          </div>
          <div className="card">
            <h3 className="mb-3 font-semibold text-ink">Reminders</h3>
            <Row title="How often should we remind you?" help="Plan reminders come as one summary, never one email per item.">
              <select className="field !h-11 sm:!w-48" value={p.reminderDigest} aria-label="Reminder frequency" onChange={(e) => update({ reminderDigest: e.target.value as P["reminderDigest"] })}>
                <option value="daily">Daily summary</option><option value="weekly">Weekly summary</option><option value="important_only">Only important</option>
              </select>
            </Row>
            <Row title="Quiet hours" help="No reminders in this window. Sign-in codes and security emails still arrive.">
              <span className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="time" className="field !h-11 !w-32" aria-label="Quiet hours start" value={p.quietStart} onChange={(e) => e.target.value && update({ quietStart: e.target.value })} />
                to
                <input type="time" className="field !h-11 !w-32" aria-label="Quiet hours end" value={p.quietEnd} onChange={(e) => e.target.value && update({ quietEnd: e.target.value })} />
              </span>
            </Row>
          </div>
          <button className="btn-outline self-start" onClick={() => update(DEFAULTS)}>Reset to defaults</button>
        </div>
      </div>
    </section>
  );
}

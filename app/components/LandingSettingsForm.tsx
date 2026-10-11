"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { uploadImage } from "@/lib/compress-image";
import { LANDING_DEFAULTS, type LandingSettings } from "@/lib/landing-settings";
import { Loading, ErrorNote } from "@/components/Charts";

const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

/** Pengaturan tampilan landing: hero (judul, deskripsi, latar), teks berjalan, dan logo mitra berjalan. */
export function LandingSettingsForm() {
  const { data, loading, error, reload } = useApi<LandingSettings>("/api/admin/settings/landing");
  const [v, setV] = useState<LandingSettings | null>(null);
  const [marqueeText, setMarqueeText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<"" | "bg" | number>("");

  useEffect(() => { if (data) { setV(data); setMarqueeText(data.marquee.join("\n")); } }, [data]);
  if (loading && !v) return <Loading />;
  if (!v) return <ErrorNote text={error} />;
  const set = <K extends keyof LandingSettings>(k: K, val: LandingSettings[K]) => setV({ ...v, [k]: val });
  const dark = v.theme === "dark";

  async function pick(kind: "bg" | number, file?: File) {
    if (!file || !v) return;
    setMsg(null); setUp(kind);
    try {
      const a = kind === "bg" ? await uploadImage(file, { maxSide: 1600, maxBytes: 380 * 1024 }) : await uploadImage(file, { maxSide: 600, maxBytes: 120 * 1024 });
      if (kind === "bg") setV({ ...v, bgImageId: a.id });
      else setV({ ...v, partners: v.partners.map((p, i) => (i === kind ? { ...p, logoId: a.id } : p)) });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setUp(""); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!v) return;
    setBusy(true); setMsg(null);
    const marquee = marqueeText.split("\n").map((t) => t.trim()).filter(Boolean);
    try {
      await api("/api/admin/settings/landing", { method: "PUT", json: { ...v, overlay: Number(v.overlay), marquee, partners: v.partners.filter((p) => p.name.trim()) } });
      setMsg({ ok: true, text: "Landing page saved. Open the home page in a private window to see it." }); reload();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }
  function reset() { setV(LANDING_DEFAULTS); setMarqueeText(LANDING_DEFAULTS.marquee.join("\n")); setMsg({ ok: true, text: "Defaults loaded. Press Save to apply." }); }

  return (
    <form onSubmit={save} className="card flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-extrabold text-navy">Landing page</h2>
        <p className="text-sm text-ink-soft">The home page guests see before signing in: hero text and background, the running text bands, and the running partner logos.</p>
      </div>
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-xs font-semibold tracking-wider text-ink-soft">HERO</legend>
        <label className={label}>Badge text (optional)<input className="field font-normal" maxLength={80} value={v.badge} onChange={(e) => set("badge", e.target.value)} /></label>
        <label className={label}>Headline<input className="field font-normal" maxLength={140} required value={v.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className={label}>Description<textarea className="field font-normal" rows={3} maxLength={320} value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={label}>Background image (optional)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm font-normal" onChange={(e) => pick("bg", e.target.files?.[0])} />
            <span className="text-xs font-normal text-ink-soft">{up === "bg" ? "Compressing and uploading…" : "Wide photo, ideally 1600 px; compressed automatically to under 380 KB."}</span>
            {v.bgImageId && <button type="button" className="self-start text-xs font-semibold text-red-700" onClick={() => set("bgImageId", "")}>Remove image</button>}
          </div>
          <div className={label}>Text style
            <div className="flex gap-1 rounded-lg bg-canvas p-1 text-sm" role="radiogroup" aria-label="Text style">
              {(["light", "dark"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={v.theme === t} onClick={() => set("theme", t)}
                  className={`flex-1 rounded-md px-3 py-2 font-semibold ${v.theme === t ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{t === "light" ? "Light background, dark text" : "Dark background, white text"}</button>
              ))}
            </div>
          </div>
        </div>
        {v.bgImageId && (
          <label className={label}>Image overlay: {v.overlay}%<input type="range" min={0} max={90} step={5} value={v.overlay} onChange={(e) => set("overlay", Number(e.target.value))} /><span className="text-xs font-normal text-ink-soft">Higher keeps the text readable on busy photos.</span></label>
        )}
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.showExample} onChange={(e) => set("showExample", e.target.checked)} />Show the example result and counseling card</label>

        <div aria-label="Hero preview" className={`relative overflow-hidden rounded-2xl border border-line p-5 ${dark ? "bg-navy text-white" : "bg-white"}`}>
          {v.bgImageId && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/assets/${v.bgImageId}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ background: dark ? `rgba(10,34,87,${v.overlay / 100})` : `rgba(255,255,255,${v.overlay / 100})` }} />
            </>
          )}
          <div className="relative flex flex-col gap-2">
            {v.badge && <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${dark ? "bg-white/15" : "bg-brand-tint text-brand-dark"}`}>{v.badge}</span>}
            <p className={`font-display text-2xl font-extrabold leading-tight ${dark ? "text-white" : "text-navy"}`}>{v.title}</p>
            <p className={`text-sm ${dark ? "text-[#DCE7F7]" : "text-ink-soft"}`}>{v.subtitle}</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-xs font-semibold tracking-wider text-ink-soft">RUNNING TEXT</legend>
        <label className={label}>One phrase per line (up to 10)
          <textarea className="field font-normal" rows={5} value={marqueeText} onChange={(e) => setMarqueeText(e.target.value)} placeholder={"Know your score\nPersonal AI Counselor"} />
          <span className="text-xs font-normal text-ink-soft">Shown as moving bands between sections. Leave empty to hide them.</span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-xs font-semibold tracking-wider text-ink-soft">PARTNER LOGOS (RUNNING)</legend>
        {v.partners.map((p, i) => (
          <div key={i} className="grid items-center gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_auto_auto]">
            <label className={label}>Partner name<input className="field font-normal" maxLength={60} value={p.name} onChange={(e) => set("partners", v.partners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>
            <div className="flex items-center gap-3">
              {p.logoId
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/assets/${p.logoId}`} alt={`${p.name} logo`} className="h-10 w-auto max-w-[120px] object-contain" />
                : <span className="text-xs text-ink-soft">No logo: the name is shown as text</span>}
              <label className="cursor-pointer text-sm font-semibold text-brand">
                {up === i ? "Uploading…" : p.logoId ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" onChange={(e) => pick(i, e.target.files?.[0])} />
              </label>
              {p.logoId && <button type="button" className="text-xs font-semibold text-red-700" onClick={() => set("partners", v.partners.map((x, j) => (j === i ? { ...x, logoId: "" } : x)))}>Remove logo</button>}
            </div>
            <button type="button" className="btn-danger !min-h-[40px]" onClick={() => set("partners", v.partners.filter((_, j) => j !== i))}>Delete</button>
          </div>
        ))}
        {v.partners.length < 10 && <button type="button" className="btn-outline self-start" onClick={() => set("partners", [...v.partners, { name: "", logoId: "" }])}>+ Add partner</button>}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button className="btn-solid" disabled={busy || up !== ""}>{busy ? "Saving…" : "Save landing page"}</button>
        <button type="button" className="btn-outline" onClick={reset}>Reset to defaults</button>
        <a href="/" target="_blank" rel="noreferrer" className="btn-outline">Open home page</a>
      </div>
    </form>
  );
}

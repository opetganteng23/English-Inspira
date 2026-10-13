"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CaptchaValue = { turnstile: string } | { token: string; answer: string } | null;
type Info = { mode: "turnstile"; siteKey: string } | { mode: "builtin"; token: string; image: string };
type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };

/** Pemeriksaan keamanan. `reload` berubah = muat tantangan baru (mis. setelah gagal masuk). */
export function Captcha({ onChange, reload = 0 }: { onChange: (v: CaptchaValue) => void; reload?: number }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onChange); cb.current = onChange;

  const load = useCallback(async () => {
    setErr(""); setAnswer(""); cb.current(null);
    try { const r = await fetch("/api/auth/captcha", { cache: "no-store" }); if (!r.ok) throw new Error(); setInfo(await r.json()); }
    catch { setErr("Could not load the security check. Check your connection and try again."); }
  }, []);
  useEffect(() => { void load(); }, [load, reload]);

  // Cloudflare Turnstile
  useEffect(() => {
    if (info?.mode !== "turnstile" || !box.current) return;
    let id: string | null = null;
    const w = window as unknown as { turnstile?: TurnstileApi };
    const draw = () => { if (box.current && w.turnstile) id = w.turnstile.render(box.current, { sitekey: info.siteKey, callback: (t: string) => cb.current({ turnstile: t }), "expired-callback": () => cb.current(null), "error-callback": () => cb.current(null) }); };
    if (w.turnstile) draw();
    else {
      let s = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!s) { s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.dataset.turnstile = "1"; document.head.appendChild(s); }
      s.addEventListener("load", draw);
    }
    return () => { if (id && w.turnstile) w.turnstile.remove(id); };
  }, [info]);

  if (err) return <div className="flex flex-col gap-2 text-sm"><p role="alert" className="text-red-700">{err}</p><button type="button" className="self-start font-semibold text-brand" onClick={load}>Try again</button></div>;
  if (!info) return <div className="h-[74px] animate-pulse rounded-xl bg-canvas" aria-label="Loading security check" />;
  if (info.mode === "turnstile") return <div ref={box} className="min-h-[65px]" />;
  return (
    <div className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
      <span>Security check</span>
      <div className="flex flex-wrap items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={info.image} alt="Security check: type the characters shown" width={204} height={67} className="rounded-lg border border-line" />
        <button type="button" onClick={load} className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-brand hover:bg-canvas" aria-label="Show different characters">New characters</button>
      </div>
      <input className="field font-normal uppercase tracking-[0.3em]" aria-label="Type the characters in the image" placeholder="Type the 5 characters" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={5} required
        value={answer} onChange={(e) => { const a = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); setAnswer(a); onChange(a.length === 5 ? { token: info.token, answer: a } : null); }} />
    </div>
  );
}

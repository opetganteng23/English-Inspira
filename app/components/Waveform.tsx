"use client";

import { useEffect, useRef, useState } from "react";
import { mmss } from "@/lib/waveform";

export type Marker = { t: number; label: string };

/** Gelombang suara dengan penanda waktu. Klik gelombang atau penanda untuk melompat; pemutar ikut menggeser garis posisi. */
export function Waveform({ src, durationSec, peaks, markers }: { src: string; durationSec: number; peaks: number[]; markers: Marker[] }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const on = () => setNow(a.currentTime);
    a.addEventListener("timeupdate", on);
    return () => a.removeEventListener("timeupdate", on);
  }, []);
  const seek = (t: number) => { const a = audio.current; if (a) { a.currentTime = Math.max(0, Math.min(durationSec, t)); void a.play().catch(() => {}); } };
  const pct = (t: number) => `${Math.min(100, (t / Math.max(1, durationSec)) * 100)}%`;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-20 w-full cursor-pointer overflow-hidden rounded-lg bg-canvas" role="slider" tabIndex={0} aria-label="Audio position" aria-valuemin={0} aria-valuemax={durationSec} aria-valuenow={Math.round(now)}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * durationSec); }}
        onKeyDown={(e) => { if (e.key === "ArrowRight") seek(now + 5); if (e.key === "ArrowLeft") seek(now - 5); }}>
        <div className="absolute inset-0 flex items-center gap-px px-1">
          {peaks.length ? peaks.map((p, i) => <span key={i} className="flex-1 rounded-sm bg-brand/60" style={{ height: `${Math.max(4, p)}%` }} />) : <span className="mx-auto text-xs text-ink-soft">Waveform not available</span>}
        </div>
        {markers.map((m, i) => <span key={i} className="absolute top-0 h-full w-0.5 bg-accent-dark" style={{ left: pct(m.t) }} title={`${mmss(m.t)} ${m.label}`} />)}
        <span className="absolute top-0 h-full w-0.5 bg-navy" style={{ left: pct(now) }} />
      </div>
      <audio ref={audio} controls preload="metadata" src={src} className="w-full" />
      {markers.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {markers.map((m, i) => <li key={i}><button type="button" className="rounded-full border border-line px-2.5 py-1 font-semibold text-navy hover:border-brand" onClick={() => seek(m.t)}>{mmss(m.t)} {m.label}</button></li>)}
        </ul>
      )}
    </div>
  );
}

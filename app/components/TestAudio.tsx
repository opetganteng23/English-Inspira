"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

type AudioGroup = { instruction?: string; audio: { id: string; finished: boolean } | null };

/**
 * Pemutar audio untuk satu soal/grup. `key` per audio WAJIB: tanpa itu React memakai ulang komponen yang sama saat pindah soal,
 * sehingga status "sudah diputar" dari audio sebelumnya terbawa dan audio berikutnya tidak bisa diputar (temuan QA 17 Okt 2026).
 */
export function GroupAudio({ kind, attemptId, group }: { kind?: string; attemptId: string; group: AudioGroup }) {
  if (!group.audio) return null;
  return kind === "practice"
    ? <PracticeAudio key={group.audio.id} attemptId={attemptId} audioId={group.audio.id} instruction={group.instruction} />
    : <AudioBox key={group.audio.id} attemptId={attemptId} audioId={group.audio.id} finished={group.audio.finished} instruction={group.instruction} />;
}

/** Mode tes: sekali putar, tanpa seek/jeda. Progres dilaporkan agar refresh melanjutkan, bukan mengulang. */
// Klip WAV senyap sangat pendek, dipakai membuka izin pemutaran di Safari/iOS.
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// Satu AudioContext untuk seluruh ruang tes: jalur suara yang sama dengan "Play test tone" di halaman persiapan.
let sharedCtx: AudioContext | null = null;
function audioCtx() {
  if (sharedCtx) return sharedCtx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  sharedCtx = AC ? new AC() : null;
  return sharedCtx;
}
/** Ruang tes membaca tanda ini untuk menghitung waktu dengar (audio Web Audio tidak terlihat sebagai elemen <audio>). */
const markPlaying = (on: boolean) => { try { document.body.dataset.audioPlaying = on ? "1" : ""; } catch { /* */ } };

function AudioBox({ attemptId, audioId, finished, instruction }: { attemptId: string; audioId: string; finished: boolean; instruction?: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "done" | "error">(finished ? "done" : "idle");
  const [msg, setMsg] = useState("");
  const lastPos = useRef(0);
  // Audio tes yang sedang dimuat di elemen <audio> (jalur cadangan). Event "ended" hanya dihitung untuk audio ini.
  const real = useRef<string | null>(null);
  const base = `/api/attempts/${attemptId}/audio/${audioId}`;
  // Audio diunduh penuh lebih dulu (sejak soal tampil) lalu didekode dan diputar lewat Web Audio dari memori perangkat:
  // jaringan tersendat tidak memotong suara, dan jalurnya sama dengan test tone yang sudah terbukti berbunyi.
  const buffer = useRef<AudioBuffer | null>(null);
  const blob = useRef<string | null>(null);
  const startAt = useRef(0);
  const src = useRef<AudioBufferSourceNode | null>(null);
  const clock = useRef<{ ctxStart: number; offset: number } | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const [level, setLevel] = useState(0);
  const [prep, setPrep] = useState<"loading" | "ready" | "stream">("loading");
  const pos = () => (clock.current && sharedCtx ? clock.current.offset + (sharedCtx.currentTime - clock.current.ctxStart) : el.current?.currentTime ?? 0);

  useEffect(() => {
    if (finished) return;
    let alive = true;
    (async () => {
      for (let tryNo = 0; tryNo < 3 && alive; tryNo++) {
        try {
          const d = await api(`${base}?prefetch=1`, { json: {}, silent: true });
          const r = await fetch(d.url, { cache: "no-store" });
          if (!r.ok) throw new Error(String(r.status));
          const bytes = await r.arrayBuffer();
          if (!alive) return;
          startAt.current = d.startAtSec || 0;
          const ctx = audioCtx();
          if (ctx) { try { buffer.current = await ctx.decodeAudioData(bytes.slice(0)); } catch { buffer.current = null; } }
          if (!buffer.current) blob.current = URL.createObjectURL(new Blob([bytes]));
          if (alive) setPrep("ready");
          return;
        } catch { await new Promise((res) => setTimeout(res, 2000)); }
      }
      if (alive) setPrep("stream"); // gagal diunduh lebih dulu: tetap bisa diputar langsung (streaming)
    })();
    return () => {
      alive = false;
      try { src.current?.stop(); } catch { /* */ }
      markPlaying(false);
      if (blob.current) { URL.revokeObjectURL(blob.current); blob.current = null; }
    };
  }, [base, finished]);

  // Bar level suara selama diputar (Web Audio).
  useEffect(() => {
    if (phase !== "playing" || !analyser.current) return;
    const data = new Uint8Array(analyser.current.fftSize);
    let raf = 0, last = 0;
    const tick = (t: number) => {
      if (t - last > 100 && analyser.current) {
        last = t; analyser.current.getByteTimeDomainData(data);
        let sum = 0; for (const v of data) sum += (v - 128) * (v - 128);
        setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setLevel(0); };
  }, [phase]);

  const finish = () => {
    markPlaying(false); setPhase("done");
    api(base, { method: "PATCH", json: { posSec: buffer.current?.duration ?? el.current?.duration ?? lastPos.current, done: true } }).catch(() => {});
  };
  // Catat mulai di server (setelah suara berjalan); 403 = sudah diputar sebelumnya.
  const record = async (onPos: (s: number) => void) => {
    for (let i = 0; i < 5; i++) {
      try { const d = await api(base, { json: {}, silent: true }); if (d?.startAtSec) onPos(d.startAtSec); return true; }
      catch (e) { if ((e as { status?: number }).status === 403) return false; await new Promise((r) => setTimeout(r, 2000)); }
    }
    return true;
  };

  async function start() {
    setMsg("");
    const ctx = sharedCtx;
    if (buffer.current && ctx) {
      // Web Audio: putar di dalam klik (resume konteks), lalu catat mulai di server.
      try {
        await ctx.resume();
        const play = (offset: number) => {
          try { src.current?.stop(); } catch { /* */ }
          const s = ctx.createBufferSource(); s.buffer = buffer.current!;
          const an = ctx.createAnalyser(); an.fftSize = 512;
          s.connect(an); an.connect(ctx.destination);
          s.onended = () => { if (src.current === s && pos() >= (buffer.current?.duration ?? 0) - 0.5) finish(); };
          src.current = s; analyser.current = an;
          clock.current = { ctxStart: ctx.currentTime, offset };
          s.start(0, Math.min(offset, Math.max(0, buffer.current!.duration - 0.1)));
        };
        play(startAt.current);
        markPlaying(true); setPhase("playing");
        const ok = await record((serverPos) => { if (serverPos > pos() + 1) play(serverPos); });
        if (!ok) { try { src.current?.stop(); } catch { /* */ } markPlaying(false); setPhase("done"); }
        return;
      } catch (e) {
        setPhase("error"); setMsg((e as Error).message || "Audio could not start. Click “Reload audio”.");
        return;
      }
    }
    const a = el.current!;
    if (blob.current) {
      // Cadangan tanpa Web Audio: elemen <audio> dari file yang sudah diunduh.
      try {
        real.current = blob.current; a.src = blob.current; a.currentTime = startAt.current;
        await a.play(); markPlaying(true); setPhase("playing");
        const ok = await record((serverPos) => { if (serverPos > a.currentTime + 1) a.currentTime = serverPos; });
        if (!ok) { a.pause(); markPlaying(false); setPhase("done"); }
        return;
      } catch (e) {
        real.current = null;
        setPhase("error");
        setMsg(e instanceof DOMException ? "The browser blocked playback. Click “Start audio” again." : (e as Error).message);
        return;
      }
    }
    // Belum/tidak bisa diunduh lebih dulu: streaming. Safari hanya mengizinkan putar langsung dari klik: buka izin dengan klip senyap.
    try { a.src = SILENT; void a.play().catch(() => {}); } catch { /* */ }
    try {
      const d = await api(base, { json: {} });
      a.pause(); real.current = d.url; a.src = d.url; a.currentTime = d.startAtSec || 0;
      await a.play(); markPlaying(true); setPhase("playing");
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (e instanceof DOMException) real.current = null;
      setPhase(status === 403 ? "done" : "error");
      setMsg(e instanceof DOMException ? "The browser blocked playback. Click “Start audio” again." : (e as Error).message);
    }
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      lastPos.current = Math.max(lastPos.current, pos());
      api(base, { method: "PATCH", json: { posSec: lastPos.current } }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [phase, base]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <p className="text-sm font-semibold text-navy">{instruction ?? "Listen to the audio"}</p>
      <audio ref={el} preload="auto" controlsList="nodownload noplaybackrate"
        onEnded={() => {
          const a = el.current;
          // Hanya audio tes yang benar-benar diputar sampai akhir (bukan klip senyap pembuka izin).
          if (!a || !real.current || (real.current.startsWith("blob:") ? a.src !== real.current : !a.src.endsWith(real.current.slice(real.current.indexOf("/api/")))) || a.currentTime < 1 || phase !== "playing") return;
          finish();
        }}
        onSeeking={() => { const a = el.current; if (a && a.currentTime > lastPos.current + 1) a.currentTime = lastPos.current; }}
        onError={() => { if (el.current?.src.startsWith("data:")) return; if (phase === "playing" && !clock.current) { setPhase("error"); setMsg("Audio failed to load. Click “Reload audio”; this does not count as replaying."); } }} />
      {phase === "idle" && <div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={start} className="btn-solid">Start audio (once only)</button><span className="text-xs text-ink-soft" role="status">{prep === "loading" ? "Preparing audio…" : prep === "ready" ? "Audio ready" : "Audio will stream"}</span></div>}
      {phase === "playing" && (
        <div className="mt-3">
          <p className="text-sm text-success" role="status">Audio is playing. It cannot be paused or replayed.</p>
          {analyser.current && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-ink-soft">Sound</span>
              <span className="flex h-4 items-end gap-[3px]" aria-hidden>{Array.from({ length: 12 }, (_, i) => <span key={i} className={`w-1.5 rounded-sm ${level * 12 > i ? (i < 8 ? "bg-success" : "bg-accent") : "bg-line"}`} style={{ height: `${30 + i * 6}%` }} />)}</span>
              <span className="text-xs text-ink-soft">If the bars move but you hear nothing, check your volume or headset.</span>
            </div>
          )}
        </div>
      )}
      {phase === "done" && <p className="mt-3 text-sm text-ink-soft">Audio has been played.</p>}
      {phase === "error" && <button onClick={start} className="btn-outline mt-3">Reload audio</button>}
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
    </div>
  );
}

/** Mode latihan: pemutar penuh (jeda, ulang, geser) dengan kecepatan 0.75×–1.25×. Tidak berlaku di placement/simulasi/kuis. */
function PracticeAudio({ attemptId, audioId, instruction }: { attemptId: string; audioId: string; instruction?: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState("");
  const [rate, setRate] = useState(1);
  const [err, setErr] = useState("");
  useEffect(() => {
    api(`/api/attempts/${attemptId}/audio/${audioId}`, { json: {} }).then((d) => setSrc(d.url)).catch((e) => setErr((e as Error).message));
  }, [attemptId, audioId]);
  useEffect(() => { if (el.current) el.current.playbackRate = rate; }, [rate, src]);
  return (
    <div className="card">
      <p className="text-sm font-semibold text-navy">{instruction ?? "Listen to the audio"} <span className="font-normal text-ink-soft">(practice mode: replay allowed)</span></p>
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
      <audio ref={el} src={src || undefined} controls preload="auto" controlsList="nodownload" className="mt-3 w-full" />
      <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">Kecepatan
        <select aria-label="Audio speed" className="field !min-h-[36px] w-auto" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{[0.75, 1, 1.25].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
      </label>
    </div>
  );
}

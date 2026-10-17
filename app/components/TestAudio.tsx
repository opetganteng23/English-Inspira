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
function AudioBox({ attemptId, audioId, finished, instruction }: { attemptId: string; audioId: string; finished: boolean; instruction?: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "done" | "error">(finished ? "done" : "idle");
  const [msg, setMsg] = useState("");
  const lastPos = useRef(0);
  const base = `/api/attempts/${attemptId}/audio/${audioId}`;

  async function start() {
    setMsg("");
    try {
      const d = await api(base, { json: {} });
      const a = el.current!; a.src = d.url; a.currentTime = d.startAtSec || 0;
      await a.play(); setPhase("playing");
    } catch (e) {
      const status = (e as { status?: number }).status;
      setPhase(status === 403 ? "done" : "error");
      setMsg(e instanceof DOMException ? "The browser blocked playback. Click “Start audio” again." : (e as Error).message);
    }
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      const a = el.current; if (!a) return;
      lastPos.current = Math.max(lastPos.current, a.currentTime);
      api(base, { method: "PATCH", json: { posSec: lastPos.current } }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [phase, base]);

  return (
    <div className="card">
      <p className="text-sm font-semibold text-navy">{instruction ?? "Listen to the audio"}</p>
      <audio ref={el} preload="auto" controlsList="nodownload noplaybackrate"
        onEnded={() => { setPhase("done"); api(base, { method: "PATCH", json: { posSec: el.current?.duration ?? lastPos.current, done: true } }).catch(() => {}); }}
        onSeeking={() => { const a = el.current; if (a && a.currentTime > lastPos.current + 1) a.currentTime = lastPos.current; }}
        onError={() => { if (phase === "playing") { setPhase("error"); setMsg("Audio failed to load. Click “Reload audio”; this does not count as replaying."); } }} />
      {phase === "idle" && <button onClick={start} className="btn-solid mt-3">Start audio (once only)</button>}
      {phase === "playing" && <p className="mt-3 text-sm text-success" role="status">Audio is playing. It cannot be paused or replayed.</p>}
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

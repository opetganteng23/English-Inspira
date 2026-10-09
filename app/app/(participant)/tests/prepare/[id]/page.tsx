"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type T = { id: string; name: string; kind: string; totalQuestions: number; totalSec: number; unlocked: boolean; reason: string | null; inProgressAttemptId: string | null };

export default function Persiapan({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error } = useApi<{ tests: T[] }>("/api/tests");
  const t = data?.tests.find((x) => x.id === params.id);
  const [audioOk, setAudioOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ctx = useRef<AudioContext | null>(null);

  // Uji perangkat audio: nada singkat lewat WebAudio (tidak butuh file/izin kamera/mikrofon).
  function beep() {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current ??= new AC();
      const o = ctx.current.createOscillator(), g = ctx.current.createGain();
      o.frequency.value = 523; g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.current.destination); o.start(); o.stop(ctx.current.currentTime + 0.6);
    } catch { setErr("No audio device detected in this browser."); }
  }
  async function begin() {
    setBusy(true); setErr("");
    try {
      const d = await api(`/api/tests/${params.id}/start`, { json: {} });
      try { await document.documentElement.requestFullscreen?.(); } catch { /* layar penuh opsional */ }
      router.push(`/test-room/${d.attemptId}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (loading) return <Loading />;
  if (!t) return <ErrorNote text={error || "Test not found"} />;
  if (!t.unlocked) return <div className="card"><p>{t.reason ?? "This test is not unlocked for your account yet."}</p><Link href="/tests" className="btn-solid mt-3">Back to the test list</Link></div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div><p className="text-sm font-semibold text-brand">PREPARATION</p><h1 className="page-title">{t.name}</h1><p className="mt-1 text-ink-soft">Full format: {t.totalQuestions} questions · about {Math.round(t.totalSec / 60)} minutes · Listening, Structure & Written Expression, Reading</p></div>

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Device check</h2>
        <p className="text-sm text-ink-soft">Put on your headset, then play the test tone. Listening audio will only be played <b>sekali</b>.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-outline" onClick={beep}>🔊 Putar nada uji</button>
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={audioOk} onChange={(e) => setAudioOk(e.target.checked)} />I can hear the tone</label>
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Rules during the test</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-soft">
          {["Stay in fullscreen; switching tabs or leaving fullscreen is recorded.", "Listening audio plays once, without pausing or replaying.", "You cannot go back to a previous section.", "The timer runs on the server: refreshing does not change the remaining time, and answers are saved automatically.", "Sessions with unusual activity notes are reviewed by the admin. No camera or microphone recording."].map((r) => <li key={r}>• {r}</li>)}
        </ul>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={ready} onChange={(e) => setReady(e.target.checked)} /><span>I understand the rules and am ready to finish the test. The test attempt is counted when the test starts.</span></label>
        <ErrorNote text={err} />
        <button className="btn-primary mt-4" disabled={!audioOk || !ready || busy} onClick={begin}>{busy ? "Memulai…" : `Start ${t.name}`}</button>
        <Link href="/tests" className="mt-3 block text-center text-sm font-semibold text-brand">Cancel</Link>
      </section>
    </div>
  );
}

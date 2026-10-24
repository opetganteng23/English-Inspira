"use client";

import { enterFullscreen } from "@/lib/fullscreen";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { requestScreen, handOffScreen, screenSupported } from "@/components/ScreenGate";

type T = { id: string; name: string; kind: string; totalQuestions: number; totalSec: number; unlocked: boolean; reason: string | null; inProgressAttemptId: string | null; secure?: boolean; screenWatch?: boolean };

export default function Persiapan({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error } = useApi<{ tests: T[] }>("/api/tests");
  const t = data?.tests.find((x) => x.id === params.id);
  const [audioOk, setAudioOk] = useState(false);
  // Uji share layar SEBELUM timer mulai: masalah izin (macOS, kebijakan IT) dibereskan tanpa memakan waktu tes.
  // Stream yang berhasil diteruskan ke ruang tes, jadi peserta tidak memilih layar dua kali.
  const [scr, setScr] = useState<{ state: "none" | "asking" | "ok" | "wrong" | "denied" | "unsupported"; why?: string }>({ state: "none" });
  useEffect(() => { if (!screenSupported()) setScr({ state: "unsupported" }); }, []);
  useEffect(() => () => { if (!started.current) handOffScreen(null); }, []);
  const started = useRef(false);
  async function testScreen() {
    setScr({ state: "asking" });
    const r = await requestScreen();
    if (!r.ok) return setScr(r.wrong ? { state: "wrong" } : { state: "denied", why: r.why });
    handOffScreen(r.stream);
    r.stream.getVideoTracks()[0]?.addEventListener("ended", () => { handOffScreen(null); setScr({ state: "none" }); });
    setScr({ state: "ok" });
  }
  const screenOk = !t?.screenWatch || scr.state === "ok" || scr.state === "unsupported";
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ctx = useRef<AudioContext | null>(null);
  // Cek koneksi sebelum mulai: 5 permintaan kecil ke server, ukur keberhasilan dan waktu respons.
  const [conn, setConn] = useState<{ state: "checking" | "good" | "fair" | "poor"; ok: number; ms: number } | null>(null);
  const checkConn = useCallback(async () => {
    setConn({ state: "checking", ok: 0, ms: 0 });
    let ok = 0, total = 0;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      try { const r = await fetch(`/api/health?c=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(5000) }); if (r.ok) { ok++; total += performance.now() - t0; } } catch { /* gagal */ }
    }
    const ms = ok ? Math.round(total / ok) : 0;
    setConn({ state: ok < 5 || ms > 2000 ? "poor" : ms > 800 ? "fair" : "good", ok, ms });
  }, []);
  useEffect(() => { void checkConn(); }, [checkConn]);

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
      started.current = true;
      await enterFullscreen();
      router.push(`/test-room/${d.attemptId}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (loading) return <Loading />;
  if (!t) return <ErrorNote text={error || "Test not found"} />;
  if (!t.unlocked) return <div className="card"><p>{t.reason ?? "This test is not unlocked for your account yet."}</p><Link href="/tests" className="btn-solid mt-3">Back to the test list</Link></div>;

  return (
    <div className="page-cols">
      <div><p className="text-sm font-semibold text-brand">PREPARATION</p><h1 className="page-title">{t.name}</h1><p className="mt-1 text-ink-soft">Full format: {t.totalQuestions} questions · about {Math.round(t.totalSec / 60)} minutes · Listening, Structure & Written Expression, Reading</p></div>

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Device check</h2>
        <p className="text-sm text-ink-soft">Put on your headset, then play the test tone. Listening audio will only be played <b>once</b>.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-outline" onClick={beep}>Play test tone</button>
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={audioOk} onChange={(e) => setAudioOk(e.target.checked)} />I can hear the tone</label>
        </div>
      </section>

      <section className={`card ${conn?.state === "poor" ? "border-red-300 bg-red-50" : ""}`}>
        <h2 className="font-display text-lg font-extrabold text-navy">Connection check</h2>
        {!conn || conn.state === "checking" ? <p className="text-sm text-ink-soft">Checking your connection to the test server…</p> : (
          <p className={`text-sm ${conn.state === "poor" ? "font-semibold text-red-700" : conn.state === "fair" ? "text-navy" : "text-success"}`}>
            {conn.state === "good" && `Good: ${conn.ok}/5 responses, average ${conn.ms} ms.`}
            {conn.state === "fair" && `Fair: ${conn.ok}/5 responses, average ${conn.ms} ms. The test should work, but a faster network is better.`}
            {conn.state === "poor" && `Unstable: only ${conn.ok}/5 responses${conn.ok ? `, average ${conn.ms} ms` : ""}. Please move to a stronger network (or your phone's hotspot) before you start.`}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-soft">If the connection drops during the test, the questions are hidden and the timer pauses. Lost time is given back when you reconnect (up to 10 minutes per section).</p>
        <button type="button" className="btn-outline mt-3 self-start" disabled={conn?.state === "checking"} onClick={() => void checkConn()}>Check again</button>
      </section>

      {t.secure && (
        <section className="card border-accent bg-accent-tint">
          <h2 className="font-display text-lg font-extrabold text-navy">Important: this test is one way</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-navy">
            <li>Questions appear one at a time. <b>You cannot go back</b> to a previous question or section.</li>
            <li><b>Choose an answer before pressing Next.</b> If you press Next without an answer, that question is skipped and cannot be answered later. It is scored as wrong.</li>
            <li>Only press <b>Finish section</b> when you are on the last question and have answered it.</li>
          </ul>
        </section>
      )}
      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Rules during the test</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-soft">
          {["Stay in fullscreen; switching tabs or leaving fullscreen is recorded.", "Listening audio plays once, without pausing or replaying.", "You cannot go back to a previous section.", "The timer runs on the server: refreshing does not change the remaining time, and answers are saved automatically.", "Watch the connection badge next to the timer. If it shows Offline, the questions are hidden and the timer pauses until you reconnect.", "Sessions with unusual activity notes are reviewed by the admin. No camera or microphone recording."].map((r) => <li key={r}>• {r}</li>)}
        </ul>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={ready} onChange={(e) => setReady(e.target.checked)} /><span>I understand the rules and am ready to finish the test. The test attempt is counted when the test starts.</span></label>
        {t.screenWatch && scr.state !== "unsupported" && (
          <div className="mt-4 rounded-xl border border-line p-4 text-sm">
            <p className="font-semibold text-navy">Screen sharing check (required)</p>
            <p className="mt-1 text-ink-soft">This test uses live screen view. Share your <b>entire screen</b> now, before the timer starts. It stays shared when the test opens.</p>
            {scr.state === "ok"
              ? <p className="mt-2 font-semibold text-success" role="status">Screen shared. You are ready.</p>
              : <button className="btn-outline mt-3" disabled={scr.state === "asking"} onClick={() => void testScreen()}>{scr.state === "asking" ? "Waiting for your choice…" : scr.state === "none" ? "Share entire screen" : "Try again"}</button>}
            {scr.state === "wrong" && <p role="alert" className="mt-2 text-red-700">You chose a window or a tab. Press Try again and choose “Entire screen”.</p>}
            {scr.state === "denied" && <p role="alert" className="mt-2 text-red-700">Sharing was cancelled or blocked. On a Mac: System Settings → Privacy &amp; Security → Screen Recording, turn on your browser, then quit and reopen it. On an office laptop, screen sharing may be blocked by IT policy; use another device or Chrome/Edge.{scr.why ? <span className="mt-1 block text-xs text-ink-soft">Error code: {scr.why}</span> : null}</p>}
          </div>
        )}
        <ErrorNote text={err} />
        <button className="btn-primary mt-4" disabled={!audioOk || !ready || !screenOk || busy} onClick={begin}>{busy ? "Starting…" : `Start ${t.name}`}</button>
        <Link href="/tests" className="mt-3 block text-center text-sm font-semibold text-brand">Cancel</Link>
      </section>
    </div>
  );
}

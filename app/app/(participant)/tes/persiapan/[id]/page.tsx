"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type T = { id: string; name: string; kind: string; totalQuestions: number; totalSec: number; unlocked: boolean; remaining: number | null; inProgressAttemptId: string | null };

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
    } catch { setErr("Perangkat audio tidak terdeteksi di browser ini."); }
  }
  async function begin() {
    setBusy(true); setErr("");
    try {
      const d = await api(`/api/tests/${params.id}/start`, { json: {} });
      try { await document.documentElement.requestFullscreen?.(); } catch { /* layar penuh opsional */ }
      router.push(`/ruang-tes/${d.attemptId}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (loading) return <Loading />;
  if (!t) return <ErrorNote text={error || "Tes tidak ditemukan"} />;
  if (!t.unlocked) return <div className="card"><p>Tes ini belum terbuka di akunmu.</p><Link href="/paket" className="btn-solid mt-3">Lihat paket</Link></div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div><p className="text-sm font-semibold text-brand">PERSIAPAN</p><h1 className="page-title">{t.name}</h1><p className="mt-1 text-ink-soft">Format penuh: {t.totalQuestions} soal · ±{Math.round(t.totalSec / 60)} menit · Listening, Structure & Written Expression, Reading</p></div>

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Cek perangkat</h2>
        <p className="text-sm text-ink-soft">Pasang headset, lalu putar nada uji. Audio Listening nanti hanya diputar <b>sekali</b>.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-outline" onClick={beep}>🔊 Putar nada uji</button>
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={audioOk} onChange={(e) => setAudioOk(e.target.checked)} />Saya mendengar nadanya</label>
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Aturan selama tes</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-soft">
          {["Tetap di layar penuh; pindah tab atau keluar layar penuh akan dicatat.", "Audio Listening diputar sekali, tanpa jeda atau ulang.", "Tidak bisa kembali ke section sebelumnya.", "Timer dipegang server: refresh tidak mengubah sisa waktu, jawaban tersimpan otomatis.", "Sesi dengan catatan aktivitas tidak biasa ditinjau admin. Tidak ada rekaman kamera atau mikrofon."].map((r) => <li key={r}>• {r}</li>)}
        </ul>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={ready} onChange={(e) => setReady(e.target.checked)} /><span>Saya paham aturannya dan siap mengerjakan sampai selesai. Jatah tes dikurangi saat tes dimulai.</span></label>
        <ErrorNote text={err} />
        <button className="btn-primary mt-4" disabled={!audioOk || !ready || busy} onClick={begin}>{busy ? "Memulai…" : `Mulai ${t.name}`}</button>
        <Link href="/tes" className="mt-3 block text-center text-sm font-semibold text-brand">Batal</Link>
      </section>
    </div>
  );
}

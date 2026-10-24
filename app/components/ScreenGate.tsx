"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Ringan untuk grid; HD (tajam, tiap 1 detik) hanya saat admin sedang memperbesar layar peserta ini.
const LIGHT = { every: 12_000, width: 960, quality: 0.6 }, HD = { every: 1_000, width: 1600, quality: 0.75 };
type St = "idle" | "asking" | "shared" | "stopped" | "wrong" | "denied" | "unsupported";

/** Galat share layar dalam bentuk yang bisa dibaca peserta/admin (dibatalkan vs diblokir sistem/kebijakan IT). */
const errText = (e: unknown) => (e instanceof DOMException ? `${e.name}${e.message ? `: ${e.message}` : ""}` : String(e));

// Stream yang sudah dibagikan di halaman persiapan (sebelum timer mulai), diteruskan ke ruang tes tanpa memilih layar lagi.
let handoff: MediaStream | null = null;

/** Minta share SELURUH layar. "wrong" bila yang dipilih jendela/tab. */
export async function requestScreen(): Promise<{ ok: true; stream: MediaStream } | { ok: false; wrong?: boolean; why?: string }> {
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor", frameRate: 5 } as MediaTrackConstraints, audio: false });
    const surface = (s.getVideoTracks()[0]?.getSettings() as { displaySurface?: string }).displaySurface;
    if (surface && surface !== "monitor") { s.getTracks().forEach((t) => t.stop()); return { ok: false, wrong: true }; }
    return { ok: true, stream: s };
  } catch (e) { return { ok: false, why: errText(e) }; }
}
export const screenSupported = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
/** Halaman persiapan: simpan stream untuk dipakai ruang tes (null = lepaskan). */
export function handOffScreen(s: MediaStream | null) {
  if (handoff && handoff !== s) handoff.getTracks().forEach((t) => t.stop());
  handoff = s;
}
const live = (s: MediaStream | null) => !!s && s.getVideoTracks().some((t) => t.readyState === "live");

/**
 * Live screen view di ruang tes. Laptop/PC: peserta membagikan SELURUH layar sebelum soal tampil; tiap ±12 detik
 * gambar kecil dikirim ke server (hanya disimpan di memori, menimpa yang lama, tidak direkam).
 * Bila share dihentikan, soal tertutup sampai layar dibagikan lagi (waktu tetap berjalan).
 * HP/tablet (browser tidak mendukung share layar): tes tetap jalan, tercatat "No screen share".
 */
export function ScreenGate({ attemptId, onCredit }: { attemptId: string; onCredit?: (sec: number) => void }) {
  // Stream dari halaman persiapan: soal tidak sempat tertutup.
  const [st, setSt] = useState<St>(() => (live(handoff) ? "shared" : "idle"));
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const hd = useRef(false);
  const creditRef = useRef(onCredit); creditRef.current = onCredit;
  // "shared" tanpa gambar menutup jeda layar penutup soal; server mengembalikan waktunya (dibatasi) dan memberi tahu jumlahnya.
  const post = useCallback((state: string, body?: Blob) => {
    void fetch(`/api/attempts/${attemptId}/screen?state=${state}`, { method: "POST", body: body ?? null, headers: body ? { "Content-Type": "image/jpeg" } : undefined, keepalive: !body })
      .then((r) => r.json()).then((d) => { if (d?.credited > 0) creditRef.current?.(d.credited); }).catch(() => {});
  }, [attemptId]);

  // Ambil satu gambar, kirim, lalu jadwalkan berikutnya sesuai mode yang diminta server (HD bila sedang ditonton).
  const tick = useCallback(async () => {
    const v = video.current;
    if (!stream.current) return;
    if (v && v.videoWidth) {
      const m = hd.current ? HD : LIGHT, w = Math.min(m.width, v.videoWidth);
      const c = document.createElement("canvas");
      c.width = w; c.height = Math.round((v.videoHeight / v.videoWidth) * w);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const b = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", m.quality));
      if (b) {
        try {
          const r = await fetch(`/api/attempts/${attemptId}/screen?state=shared`, { method: "POST", body: b, headers: { "Content-Type": "image/jpeg" } });
          hd.current = !!(await r.json().catch(() => ({})))?.hd;
        } catch { /* jaringan: coba lagi di putaran berikutnya */ }
      }
    }
    if (stream.current) timer.current = setTimeout(() => void tick(), (hd.current ? HD : LIGHT).every);
  }, [attemptId]);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const [why, setWhy] = useState("");
  const adopt = useCallback(async (s: MediaStream) => {
      const track = s.getVideoTracks()[0];
      stream.current = s;
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.srcObject = s; await v.play().catch(() => {});
      video.current = v;
      track.addEventListener("ended", () => { stop(); setSt("stopped"); post("stopped"); });
      if (s.getVideoTracks()[0]?.readyState !== "live") { stop(); setSt("stopped"); post("stopped"); return; }
      setSt("shared");
      post("shared");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void tick(), 1500);
  }, [post, stop, tick]);

  useEffect(() => {
    if (!screenSupported()) { setSt("unsupported"); post("unsupported"); return () => stop(); }
    // Sudah dibagikan di halaman persiapan: langsung dipakai, soal tidak tertutup.
    if (live(handoff)) { const s = handoff!; handoff = null; void adopt(s); }
    else { handoff = null; post("gate"); } // layar penutup soal mulai tampil: server mencatat sejak kapan
    return () => stop();
  }, [post, stop, adopt]);

  async function share() {
    setSt("asking"); setWhy("");
    const r = await requestScreen();
    if (r.ok) return adopt(r.stream);
    if (r.wrong) { setSt("wrong"); return; }
    // Nama galat ditampilkan agar penyebab bisa dibedakan dari tangkapan layar peserta (dibatalkan vs diblokir sistem/kebijakan perangkat).
    setWhy(r.why ?? ""); setSt("denied"); post("denied");
  }

  if (st === "shared" || st === "unsupported") return null;
  const msg: Record<string, [string, string]> = {
    idle: ["Share your screen to start", "This test uses live screen view. Choose “Entire screen” in the next window. Your screen is watched live by the proctor during the test only; nothing is recorded or stored."],
    asking: ["Waiting for your choice…", "Choose “Entire screen”, then press Share."],
    wrong: ["Please share your entire screen", "You chose a window or a tab. Press the button again and choose “Entire screen”."],
    denied: ["Screen sharing is required", "Sharing was cancelled or blocked. Press the button, choose “Entire screen” and press Share. If this window keeps coming back: on a Mac, open System Settings → Privacy & Security → Screen Recording, turn on your browser, then quit and reopen it. On an office laptop, screen sharing may be blocked by IT policy; use another device or browser (Chrome/Edge). The timer keeps running."],
    stopped: ["Screen sharing stopped", "The questions are hidden until you share your entire screen again. The timer keeps running."],
  };
  const [title, body] = msg[st] ?? msg.idle;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center">
        <h2 className="font-display text-xl font-extrabold text-navy">{title}</h2>
        {st === "denied" && why && <p className="mt-2 text-xs text-ink-soft">Error code: {why}</p>}
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <button className="btn-solid mt-5 w-full" disabled={st === "asking"} onClick={share}>{st === "stopped" || st === "denied" || st === "wrong" ? "Share entire screen again" : "Share entire screen"}</button>
      </div>
    </div>
  );
}

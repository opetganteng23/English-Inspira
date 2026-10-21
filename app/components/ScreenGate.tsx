"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const EVERY_MS = 12_000, WIDTH = 640, QUALITY = 0.5;
type St = "idle" | "asking" | "shared" | "stopped" | "wrong" | "denied" | "unsupported";

/**
 * Live screen view di ruang tes. Laptop/PC: peserta membagikan SELURUH layar sebelum soal tampil; tiap ±12 detik
 * gambar kecil dikirim ke server (hanya disimpan di memori, menimpa yang lama, tidak direkam).
 * Bila share dihentikan, soal tertutup sampai layar dibagikan lagi (waktu tetap berjalan).
 * HP/tablet (browser tidak mendukung share layar): tes tetap jalan, tercatat "No screen share".
 */
export function ScreenGate({ attemptId }: { attemptId: string }) {
  const [st, setSt] = useState<St>("idle");
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const post = useCallback((state: string, body?: Blob) => {
    void fetch(`/api/attempts/${attemptId}/screen?state=${state}`, { method: "POST", body: body ?? null, headers: body ? { "Content-Type": "image/jpeg" } : undefined, keepalive: !body }).catch(() => {});
  }, [attemptId]);

  const snap = useCallback(() => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = WIDTH; c.height = Math.round((v.videoHeight / v.videoWidth) * WIDTH);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (b) post("shared", b); }, "image/jpeg", QUALITY);
  }, [post]);

  const stop = useCallback(() => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.getDisplayMedia) { setSt("unsupported"); post("unsupported"); }
    return () => stop();
  }, [post, stop]);

  async function share() {
    setSt("asking");
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor", frameRate: 1 } as MediaTrackConstraints, audio: false });
      const track = s.getVideoTracks()[0];
      const surface = (track.getSettings() as { displaySurface?: string }).displaySurface;
      if (surface && surface !== "monitor") { s.getTracks().forEach((t) => t.stop()); setSt("wrong"); return; }
      stream.current = s;
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.srcObject = s; await v.play().catch(() => {});
      video.current = v;
      track.addEventListener("ended", () => { stop(); setSt("stopped"); post("stopped"); });
      setSt("shared");
      post("shared");
      setTimeout(snap, 1500);
      clearInterval(timer.current);
      timer.current = setInterval(snap, EVERY_MS);
    } catch {
      setSt("denied"); post("denied");
    }
  }

  if (st === "shared" || st === "unsupported") return null;
  const msg: Record<string, [string, string]> = {
    idle: ["Share your screen to start", "This test uses live screen view. Choose “Entire screen” in the next window. Your screen is watched live by the proctor during the test only; nothing is recorded or stored."],
    asking: ["Waiting for your choice…", "Choose “Entire screen”, then press Share."],
    wrong: ["Please share your entire screen", "You chose a window or a tab. Press the button again and choose “Entire screen”."],
    denied: ["Screen sharing is required", "Sharing was cancelled or blocked. Press the button and allow screen sharing to continue. The timer keeps running."],
    stopped: ["Screen sharing stopped", "The questions are hidden until you share your entire screen again. The timer keeps running."],
  };
  const [title, body] = msg[st] ?? msg.idle;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center">
        <h2 className="font-display text-xl font-extrabold text-navy">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <button className="btn-solid mt-5 w-full" disabled={st === "asking"} onClick={share}>{st === "stopped" || st === "denied" || st === "wrong" ? "Share entire screen again" : "Share entire screen"}</button>
      </div>
    </div>
  );
}

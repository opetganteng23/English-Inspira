"use client";

import { useEffect, useRef } from "react";

/**
 * Kirim heartbeat waktu belajar aktif (MTS §13.1): hanya saat tab terlihat dan ada interaksi dalam `idleTimeoutSec`
 * terakhir. Waktu diam tidak dihitung. Gagal kirim diabaikan (tidak mengganggu belajar).
 */
export function useActiveTime(kind: "material" | "unit", refId: string | null) {
  const idleSec = useRef(60);
  useEffect(() => {
    if (!refId) return;
    let lastInput = Date.now(), lastBeat = Date.now(), stopped = false;
    const touch = () => { lastInput = Date.now(); };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const beat = async () => {
      const now = Date.now();
      const elapsed = Math.round((now - lastBeat) / 1000);
      lastBeat = now;
      const active = document.visibilityState === "visible" && now - lastInput <= idleSec.current * 1000;
      if (!active || elapsed <= 0 || stopped) return;
      try {
        const r = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, refId, activeSec: Math.min(elapsed, 30) }) });
        const d = await r.json().catch(() => ({}));
        if (typeof d.idleTimeoutSec === "number") idleSec.current = d.idleTimeoutSec;
      } catch { /* abaikan */ }
    };
    const t = setInterval(beat, 15_000);
    return () => { stopped = true; clearInterval(t); evs.forEach((e) => window.removeEventListener(e, touch)); };
  }, [kind, refId]);
}

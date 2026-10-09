"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildSrcdoc, SANDBOX, type HtmlDoc } from "@/lib/material-doc";
import { makeRateGate, newNonce, parseBridgeMessage } from "@/lib/material-bridge";

/**
 * Menampilkan materi HTML interaktif sebagai satu halaman (MTS §10.3).
 * - sandbox hanya `allow-scripts allow-forms`: origin buram, tanpa popup/modal/navigasi atas, tanpa cookie/storage/API.
 * - Pesan dipercaya hanya bila berasal dari iframe ini (event.source), berversi, bernonce benar, lolos Zod, dan tidak melampaui batas frekuensi.
 * - `onProgress` menerima laporan sementara (report) dan penyelesaian (complete) dengan penanda `final`.
 */
export function MaterialFrame({ doc, onProgress, minHeight = 240 }: { doc: HtmlDoc; onProgress?: (score: number, answers: unknown, final: boolean) => void; minHeight?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  // Nonce baru untuk setiap dokumen; iframe lama tidak bisa melapor ke dokumen baru.
  const nonce = useMemo(() => newNonce(), [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const srcDoc = useMemo(() => (origin ? buildSrcdoc(doc, origin, nonce) : ""), [doc, origin, nonce]);

  useEffect(() => {
    const gate = makeRateGate();
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const m = parseBridgeMessage(e.data, nonce);
      if (!m) return;
      if (m.type === "height") return setHeight(Math.min(20000, Math.max(minHeight, Math.ceil(m.h))));
      if (gate()) onProgress?.(m.score, m.answers, m.type === "complete");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onProgress, minHeight, nonce]);

  if (!srcDoc) return <div style={{ height: minHeight }} className="animate-pulse rounded-xl bg-canvas" aria-label="Loading material" />;
  return (
    <iframe
      ref={ref} title="Interactive material" srcDoc={srcDoc} referrerPolicy="no-referrer" loading="lazy"
      sandbox={SANDBOX}
      style={{ width: "100%", height, border: 0, display: "block" }} className="rounded-xl bg-white"
    />
  );
}

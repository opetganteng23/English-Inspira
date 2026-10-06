"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildSrcdoc, type HtmlDoc } from "@/lib/material-doc";

/**
 * Menampilkan materi HTML interaktif sebagai satu halaman.
 * - sandbox TANPA allow-same-origin: skrip materi berjalan di origin buram, tidak bisa membaca cookie/localStorage
 *   atau memanggil /api/* sebagai pengguna.
 * - Hanya pesan dari iframe ini (event.source) yang dipercaya; bentuknya divalidasi sebelum dipakai.
 */
export function MaterialFrame({ doc, onProgress, minHeight = 240 }: { doc: HtmlDoc; onProgress?: (score: number, answers: unknown) => void; minHeight?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const srcDoc = useMemo(() => (origin ? buildSrcdoc(doc, origin) : ""), [doc, origin]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return; // pesan dari sumber lain diabaikan
      const d = e.data as { __ei?: string; h?: unknown; score?: unknown; answers?: unknown } | null;
      if (!d || typeof d !== "object") return;
      if (d.__ei === "height" && typeof d.h === "number" && Number.isFinite(d.h)) setHeight(Math.min(20000, Math.max(minHeight, Math.ceil(d.h))));
      else if (d.__ei === "progress" && typeof d.score === "number" && Number.isFinite(d.score)) onProgress?.(Math.min(100, Math.max(0, d.score)), d.answers ?? null);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onProgress, minHeight]);

  if (!srcDoc) return <div style={{ height: minHeight }} className="animate-pulse rounded-xl bg-canvas" aria-label="Memuat materi" />;
  return (
    <iframe
      ref={ref} title="Materi interaktif" srcDoc={srcDoc} referrerPolicy="no-referrer" loading="lazy"
      sandbox="allow-scripts allow-forms allow-modals"
      style={{ width: "100%", height, border: 0, display: "block" }} className="rounded-xl bg-white"
    />
  );
}

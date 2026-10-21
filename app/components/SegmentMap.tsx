"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapPoint = { key: string; label: string; lat: number; lng: number; finished: number; avg: number | null; pctTarget: number | null };

/** Peta cabang: lingkaran sebesar jumlah peserta selesai, warna dari rata-rata skor dibanding target. Klik untuk memilih cabang. */
export function SegmentMap({ points, target, onPick }: { points: MapPoint[]; target: number; onPick?: (key: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  useEffect(() => {
    let alive = true;
    void import("leaflet").then((L) => {
      if (!alive || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([-2.5, 118], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 10, minZoom: 4, attribution: "© OpenStreetMap" }).addTo(map.current);
      }
      layer.current?.remove();
      const g = L.layerGroup().addTo(map.current);
      const max = Math.max(1, ...points.map((p) => p.finished));
      for (const p of points) {
        const color = p.avg == null ? "#94a3b8" : p.avg >= target ? "#1D6B3F" : p.avg >= target - 50 ? "#F28C28" : "#C2412D";
        const c = L.circleMarker([p.lat, p.lng], { radius: 6 + 18 * Math.sqrt(p.finished / max), color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.85 }).addTo(g);
        c.bindTooltip(`<b>${p.label}</b><br>${p.finished} finished · avg ${p.avg != null ? Math.round(p.avg) : "-"}${p.pctTarget != null ? ` · ${Math.round(p.pctTarget)}% ≥ ${target}` : ""}`);
        if (onPick) c.on("click", () => onPick(p.key));
      }
      layer.current = g;
    });
    return () => { alive = false; };
  }, [points, target, onPick]);
  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);
  return (
    <div>
      <div ref={el} className="h-[420px] w-full overflow-hidden rounded-xl border border-line" role="img" aria-label="Map of branches by average score" />
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-[#1D6B3F] align-middle" />avg ≥ {target}</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-[#F28C28] align-middle" />{target - 50}–{target - 1}</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-[#C2412D] align-middle" />below {target - 50}</span>
        <span>circle size = participants finished</span>
      </div>
    </div>
  );
}

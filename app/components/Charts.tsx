// Grafik SVG ringan: responsif lewat viewBox, aksesibel lewat <title>/aria-label. Warna dari token merek.

export function LineChart({ points, target, min = 310, max = 677, label = "Score progress" }: { points: { label: string; value: number }[]; target?: number | null; min?: number; max?: number; label?: string }) {
  const W = 600, H = 220, P = { l: 40, r: 16, t: 16, b: 34 };
  if (!points.length) return <p className="py-8 text-center text-sm text-ink-soft">No test results yet.</p>;
  const lo = Math.min(min, ...points.map((p) => p.value), target ?? min), hi = Math.max(max, ...points.map((p) => p.value), target ?? max);
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1));
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}${target ? `, target ${target}` : ""}`} className="h-auto w-full">
      {ticks.map((t) => (<g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#DCE3ED" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4B5A70">{t}</text></g>))}
      {target ? (<g><line x1={P.l} x2={W - P.r} y1={y(target)} y2={y(target)} stroke="#F08A1C" strokeDasharray="5 4" strokeWidth="1.5" /><text x={W - P.r} y={y(target) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill="#B85A00">Target {target}</text></g>) : null}
      <path d={path} fill="none" stroke="#1B5FB8" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (<g key={i}><circle cx={x(i)} cy={y(p.value)} r="5" fill="#1B5FB8" stroke="#fff" strokeWidth="2"><title>{`${p.label}: ${p.value}`}</title></circle><text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0F2F5E">{p.value}</text><text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="#4B5A70">{p.label.length > 14 ? p.label.slice(0, 13) + "…" : p.label}</text></g>))}
    </svg>
  );
}

/** Batang horizontal berlabel. `max` default = nilai terbesar. */
export function HBars({ rows, max, unit = "", color = "#1B5FB8" }: { rows: { label: string; value: number; sub?: string }[]; max?: number; unit?: string; color?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-soft">No data yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium text-navy">{r.label}</span><span className="shrink-0 font-semibold text-navy">{r.value.toLocaleString("en-GB")}{unit}{r.sub ? <span className="ml-1 font-normal text-ink-soft">{r.sub}</span> : null}</span></div>
          <div className="h-2.5 rounded-full bg-canvas" role="presentation"><div className="h-2.5 rounded-full" style={{ width: `${Math.max(2, (r.value / m) * 100)}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="card !p-4">
      <p className="text-xs font-semibold tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-navy sm:text-3xl">{value}</p>
      {sub != null && <p className={`mt-1 text-sm ${tone === "ok" ? "text-success" : tone === "warn" ? "text-accent-dark" : "text-ink-soft"}`}>{sub}</p>}
    </div>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) { return <p className="py-6 text-ink-soft" role="status">{text}</p>; }
export function ErrorNote({ text }: { text: string }) { return text ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{text}</p> : null; }
export function Empty({ children }: { children: React.ReactNode }) { return <div className="card py-10 text-center text-ink-soft">{children}</div>; }

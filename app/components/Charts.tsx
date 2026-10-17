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
      {target ? (<g><line x1={P.l} x2={W - P.r} y1={y(target)} y2={y(target)} stroke="#D9A02F" strokeDasharray="5 4" strokeWidth="1.5" /><text x={W - P.r} y={y(target) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill="#8A5A00">Target {target}</text></g>) : null}
      <path d={path} fill="none" stroke="#0B4FA6" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (<g key={i}><circle cx={x(i)} cy={y(p.value)} r="5" fill="#0B4FA6" stroke="#fff" strokeWidth="2"><title>{`${p.label}: ${p.value}`}</title></circle><text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0A2257">{p.value}</text><text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="#4B5A70">{p.label.length > 14 ? p.label.slice(0, 13) + "…" : p.label}</text></g>))}
    </svg>
  );
}

/** Batang horizontal berlabel. `max` default = nilai terbesar. */
export function HBars({ rows, max, unit = "", color = "#0B4FA6" }: { rows: { label: string; value: number; sub?: string }[]; max?: number; unit?: string; color?: string }) {
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

/** Donat proporsi. Segmen bernilai 0 tidak digambar; tengah menampilkan total. */
export function Donut({ parts, centerLabel }: { parts: { label: string; value: number; color: string }[]; centerLabel?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  if (!total) return <p className="py-6 text-center text-sm text-ink-soft">No data yet.</p>;
  return (
    <svg viewBox="0 0 140 140" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")} className="h-40 w-40 shrink-0">
      <g transform="rotate(-90 70 70)">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#EEF2F7" strokeWidth="18" />
        {parts.filter((p) => p.value > 0).map((p) => { const len = (p.value / total) * C; const el = <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}><title>{`${p.label}: ${p.value}`}</title></circle>; off += len; return el; })}
      </g>
      <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0A2257">{total}</text>
      <text x="70" y="85" textAnchor="middle" fontSize="10" fill="#4B5A70">{centerLabel ?? "questions"}</text>
    </svg>
  );
}

/** Batang bertumpuk benar/salah/kosong per section (agregat; tidak menampilkan hasil per soal). */
export function OutcomeBars({ rows }: { rows: { label: string; correct: number; wrong: number; blank: number }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const t = Math.max(1, r.correct + r.wrong + r.blank);
        return (
          <div key={r.label}>
            <p className="mb-1 flex justify-between text-xs"><span className="font-semibold text-navy">{r.label}</span><span className="text-ink-soft">{r.correct} correct · {r.wrong} wrong · {r.blank} blank</span></p>
            <div className="flex h-3 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${r.label}: ${r.correct} correct, ${r.wrong} wrong, ${r.blank} blank`}>
              <span style={{ width: `${(r.correct / t) * 100}%`, background: "#1E8E5A" }} /><span style={{ width: `${(r.wrong / t) * 100}%`, background: "#C0392B" }} /><span style={{ width: `${(r.blank / t) * 100}%`, background: "#9AA8BC" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Kecepatan vs akurasi: sumbu X = rata-rata detik per soal, sumbu Y = akurasi. Garis bantu: median waktu dan 70%. */
export function SpeedScatter({ points }: { points: { label: string; avgSec: number; accuracy: number; n: number; kind: string }[] }) {
  const W = 600, H = 260, P = { l: 44, r: 16, t: 14, b: 38 };
  if (!points.length) return null;
  const maxX = Math.max(10, ...points.map((p) => p.avgSec)) * 1.1;
  const x = (v: number) => P.l + (v / maxX) * (W - P.l - P.r), y = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const color: Record<string, string> = { solid: "#1E8E5A", slow: "#D9A02F", rushed: "#E07B39", concept: "#C0392B" };
  const sorted = [...points].map((p) => p.avgSec).sort((a, b) => a - b), m = sorted.length >> 1, mid = sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Speed versus accuracy: ${points.map((p) => `${p.label} ${p.avgSec} seconds, ${p.accuracy} percent`).join("; ")}`} className="h-auto w-full">
      {[0, 50, 100].map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#DCE3ED" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4B5A70">{t}%</text></g>)}
      <line x1={P.l} x2={W - P.r} y1={y(70)} y2={y(70)} stroke="#9AA8BC" strokeDasharray="4 4" />
      <line x1={x(mid)} x2={x(mid)} y1={P.t} y2={H - P.b} stroke="#9AA8BC" strokeDasharray="4 4" />
      {points.map((p) => <g key={p.label}><circle cx={x(p.avgSec)} cy={y(p.accuracy)} r={5 + Math.min(5, p.n / 4)} fill={color[p.kind] ?? "#0B4FA6"} fillOpacity=".85" stroke="#fff" strokeWidth="1.5"><title>{`${p.label}: ${p.avgSec}s average, ${p.accuracy}% correct, ${p.n} questions`}</title></circle><text x={x(p.avgSec) + (x(p.avgSec) > W - 120 ? -10 : 10)} y={y(p.accuracy) - 8} textAnchor={x(p.avgSec) > W - 120 ? "end" : "start"} fontSize="10" fontWeight="600" fill="#0A2257">{p.label.length > 16 ? p.label.slice(0, 15) + "…" : p.label}</text></g>)}
      <text x={(P.l + W - P.r) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#4B5A70">Average seconds per question (slower to the right)</text>
      <text x={P.l + 4} y={P.t + 10} fontSize="10" fill="#4B5A70">fast, accurate</text>
      <text x={W - P.r - 4} y={P.t + 10} textAnchor="end" fontSize="10" fill="#4B5A70">slow, accurate</text>
      <text x={P.l + 4} y={H - P.b - 6} fontSize="10" fill="#4B5A70">fast, often wrong</text>
      <text x={W - P.r - 4} y={H - P.b - 6} textAnchor="end" fontSize="10" fill="#4B5A70">slow, often wrong</text>
    </svg>
  );
}

/** Tiga batang per section: akurasi di awal, tengah, akhir. */
export function ThirdsBars({ rows }: { rows: { label: string; thirds: number[] }[] }) {
  const names = ["Start", "Middle", "End"];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="mb-1 text-xs font-semibold text-navy">{r.label}</p>
          <svg viewBox="0 0 150 90" role="img" aria-label={`${r.label} accuracy: ${r.thirds.map((v, i) => `${names[i]} ${v} percent`).join(", ")}`} className="h-auto w-full">
            {r.thirds.map((v, i) => <g key={i}><rect x={10 + i * 46} y={65 - v * 0.55} width="34" height={Math.max(1, v * 0.55)} rx="3" fill="#0B4FA6"><title>{`${names[i]}: ${v}%`}</title></rect><text x={27 + i * 46} y={60 - v * 0.55} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0A2257">{v}%</text><text x={27 + i * 46} y="80" textAnchor="middle" fontSize="9" fill="#4B5A70">{names[i]}</text></g>)}
          </svg>
        </div>
      ))}
    </div>
  );
}

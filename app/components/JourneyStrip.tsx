"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";

type Phase = { state: "done" | "current" | "upcoming"; detail: string; href: string; cta: string };

const META = [
  { name: "Discover", tool: "Placement" },
  { name: "Learn", tool: "Courses" },
  { name: "Analyze", tool: "AI analysis" },
  { name: "Improve", tool: "Study plan" },
  { name: "Experience", tool: "Simulation" },
  { name: "Measure", tool: "Progress" },
  { name: "Certify", tool: "Official ITP" },
];
const DOT = { done: "bg-success text-white", current: "bg-accent text-navy fx-ring", upcoming: "bg-canvas text-ink-soft" } as const;
const WORD = { done: "Done", current: "In progress", upcoming: "Up next" } as const;

/** English Intelligence Journey sebagai strip ringkas di dasbor (sebelumnya halaman My Journey tersendiri). Status dari data nyata peserta. */
export function JourneyStrip() {
  const { data } = useApi<{ phases: Phase[]; completed: number; total: number }>("/api/journey");
  if (!data) return <div className="card h-[132px] animate-pulse !p-4" aria-hidden />;
  const pct = Math.round((data.completed / data.total) * 100);
  return (
    <section className="card !p-4 sm:!p-5" aria-label="Your journey">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-extrabold text-navy">Your journey</h2>
          <p className="text-xs text-ink-soft">English Intelligence Journey™ · {data.completed} of {data.total} stages completed</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-canvas sm:w-48" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress"><div className="h-2 rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} /></div>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {data.phases.map((p, i) => (
          <li key={META[i].name}>
            <Link href={p.href} title={p.detail} className={`group flex h-full flex-col gap-1 rounded-xl border p-3 transition hover:-translate-y-0.5 hover:border-brand ${p.state === "current" ? "border-brand bg-brand-tint" : "border-line bg-white"}`}>
              <span className="flex items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${DOT[p.state]}`}>{p.state === "done" ? "✓" : i + 1}</span>
                <span className="font-semibold text-navy text-[13px] leading-tight">{META[i].name}</span>
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{META[i].tool}</span>
              <span className={`text-xs ${p.state === "done" ? "text-success" : p.state === "current" ? "font-semibold text-brand-dark" : "text-ink-soft"}`}>{WORD[p.state]}</span>
              <span className="line-clamp-2 text-xs text-ink-soft group-hover:text-ink">{p.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

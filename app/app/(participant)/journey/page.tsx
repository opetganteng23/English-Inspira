"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";

type Phase = { state: "done" | "current" | "upcoming"; detail: string; href: string; cta: string };

const META = [
  { name: "Discover", tag: "Know where you stand", tool: "Placement test", desc: "An ITP-format test gives your starting score per section and per question type." },
  { name: "Learn", tag: "Learn with purpose", tool: "Courses", desc: "Courses, units, and interactive materials matched to your level." },
  { name: "Analyze", tag: "Turn results into insight", tool: "AI analysis", desc: "AI analysis explains your error patterns and the reasons behind your score." },
  { name: "Improve", tag: "Focus on what matters most", tool: "Study plan", desc: "A study plan and coaching sessions focused on the section furthest from your target." },
  { name: "Experience", tag: "Simulate the real test", tool: "Simulation", desc: "A full simulation with section timers, audio played once, and test-room monitoring." },
  { name: "Measure", tag: "Validate readiness", tool: "Progress", desc: "Track your progress per section and see when you are ready for the official test." },
  { name: "Certify", tag: "Achieve your goal", tool: "Official ITP", desc: "Take the official TOEFL ITP on a scheduled date and receive your certificate." },
];
const CHIP = { done: ["Completed", "badge-ok"], current: ["In progress", "badge-warn"], upcoming: ["Up next", "badge-muted"] } as const;

export default function Journey() {
  const { data, loading, error } = useApi<{ phases: Phase[]; completed: number; total: number }>("/api/journey");
  if (loading) return <Loading />;
  if (!data) return <ErrorNote text={error} />;
  const pct = Math.round((data.completed / data.total) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold tracking-[1.5px] text-accent-dark">ENGLISH INTELLIGENCE JOURNEY™</p>
        <h1 className="page-title">My Journey</h1>
        <p className="mt-1 text-sm text-ink-soft sm:text-base">Seven stages from knowing your score to certification. Each stage updates from what you actually do.</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.phases.map((p, i) => {
          const m = META[i];
          return (
            <li key={m.name} className={`flex flex-col gap-1.5 rounded-2xl border bg-white p-4 sm:p-5 ${p.state === "current" ? "border-brand shadow-[0_0_0_3px_rgba(11,79,166,0.12)]" : "border-line"} ${p.state === "upcoming" ? "opacity-90" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wider text-ink-soft">PHASE {String(i + 1).padStart(2, "0")}</span>
                <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand-dark">{m.tool}</span>
              </div>
              <h2 className="font-display text-xl font-extrabold text-navy">{m.name}</h2>
              <p className="text-sm font-semibold text-accent-dark">{m.tag}</p>
              <p className="text-sm text-ink-soft">{m.desc}</p>
              <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
                <span className="flex items-center justify-between gap-2"><span className={CHIP[p.state][1]}>{CHIP[p.state][0]}</span></span>
                <p className="text-xs text-ink-soft">{p.detail}</p>
                <Link href={p.href} className={p.state === "upcoming" ? "btn-outline" : "btn-solid"}>{p.cta}</Link>
              </div>
            </li>
          );
        })}
        <li className="flex flex-col justify-between gap-4 rounded-2xl bg-navy p-5 text-white sm:col-span-2 xl:col-span-1">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#B9CBE6]">YOUR PROGRESS</p>
            <p className="mt-1 font-display text-4xl font-extrabold">{data.completed}<span className="text-xl text-[#B9CBE6]"> / {data.total}</span></p>
            <p className="text-sm text-mist">stages completed</p>
          </div>
          <div className="h-2 rounded-full bg-navy-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress"><div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
        </li>
      </ol>
    </div>
  );
}

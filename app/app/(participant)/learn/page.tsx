"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Unit = { id: string; title: string; description: string; status: "not_started" | "in_progress" | "completed"; done: number; total: number };
type Course = { id: string; title: string; description: string; units: Unit[]; completed: number };
const ST = { not_started: ["Not started", "badge-muted"], in_progress: ["In progress", "badge-warn"], completed: ["Completed", "badge-ok"] } as const;

export default function Belajar() {
  const { data, loading, error } = useApi<{ needsPlacement: boolean; courses: Course[] }>("/api/courses");
  const [picked, setPicked] = useState<string | null>(null);
  if (loading) return <Loading />;

  const courses = data?.courses ?? [];
  // Default: course yang sedang berjalan, lalu yang belum selesai, lalu yang pertama.
  const current = courses.find((c) => c.id === picked)
    ?? courses.find((c) => c.units.some((u) => u.status === "in_progress"))
    ?? courses.find((c) => c.completed < c.units.length)
    ?? courses[0];

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Learn</h1><p className="mt-1 text-sm text-ink-soft sm:text-base">Pick a course for your level. Finish the required materials and pass the quiz to complete a unit.</p></div>
      <ErrorNote text={error} />
      {data?.needsPlacement && <Empty>Take the placement test first to unlock courses for your level. <Link href="/tests" className="font-semibold text-brand">Go to My Tests</Link></Empty>}
      {data && !data.needsPlacement && courses.length === 0 && <Empty>No courses for your level yet.</Empty>}

      {courses.length > 0 && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Courses">
            {courses.map((c) => {
              const pct = c.units.length ? Math.round((c.completed / c.units.length) * 100) : 0;
              const on = current?.id === c.id;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setPicked(c.id)} aria-pressed={on}
                    className={`flex h-full w-full flex-col gap-2 rounded-2xl border-[1.5px] bg-white p-4 text-left transition sm:p-5 ${on ? "border-brand shadow-[0_0_0_3px_rgba(11,79,166,0.12)]" : "border-line hover:border-line-strong"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className={pct === 100 ? "badge-ok" : pct > 0 ? "badge-warn" : "badge-muted"}>{pct === 100 ? "Completed" : pct > 0 ? "In progress" : "Not started"}</span>
                      <span className="text-xs text-ink-soft">{c.units.length} {c.units.length === 1 ? "unit" : "units"}</span>
                    </span>
                    <span className="font-display text-lg font-extrabold leading-snug text-navy">{c.title}</span>
                    {c.description && <span className="line-clamp-2 text-sm text-ink-soft">{c.description}</span>}
                    <span className="mt-auto flex items-center gap-3 pt-1">
                      <span className="h-2 flex-1 rounded-full bg-canvas" role="progressbar" aria-valuenow={c.completed} aria-valuemax={c.units.length} aria-label={`${c.title} progress`}><span className="block h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></span>
                      <span className="text-xs font-semibold text-ink-soft">{c.completed}/{c.units.length}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {current && (
            <section aria-label={`Units in ${current.title}`}>
              <h2 className="font-display text-xl font-extrabold text-navy">{current.title}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {current.units.map((u, i) => (
                  <li key={u.id}>
                    <Link href={`/learn/${u.id}`} className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-white p-4 hover:border-brand">
                      <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink-soft">UNIT {i + 1}</span><span className={ST[u.status][1]}>{ST[u.status][0]}</span></span>
                      <b className="text-navy">{u.title}</b>
                      {u.description && <span className="line-clamp-2 text-sm text-ink-soft">{u.description}</span>}
                      <span className="mt-auto pt-1 text-xs text-ink-soft">{u.done}/{u.total} parts</span>
                    </Link>
                  </li>
                ))}
                {current.units.length === 0 && <li className="text-sm text-ink-soft">No units in this course yet.</li>}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

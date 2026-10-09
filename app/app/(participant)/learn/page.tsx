"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Unit = { id: string; title: string; description: string; status: "not_started" | "in_progress" | "completed"; done: number; total: number };
type Course = { id: string; title: string; description: string; units: Unit[]; completed: number };
const ST = { not_started: ["Not started", "badge-muted"], in_progress: ["In progress", "badge-warn"], completed: ["Completed", "badge-ok"] } as const;

export default function Belajar() {
  const { data, loading, error } = useApi<{ needsPlacement: boolean; courses: Course[] }>("/api/courses");
  if (loading) return <Loading />;
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="page-title">Learn</h1><p className="mt-1 text-ink-soft">Courses and units for your level. Finish the required materials and pass the quiz to complete a unit.</p></div>
      <ErrorNote text={error} />
      {data?.needsPlacement && <Empty>Take the placement test first to unlock courses for your level. <Link href="/tests" className="font-semibold text-brand">Go to My Tests</Link></Empty>}
      {data && !data.needsPlacement && data.courses.length === 0 && <Empty>No courses for your level yet.</Empty>}
      {data?.courses.map((c) => (
        <section key={c.id} className="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">{c.title}</h2><span className="text-sm text-ink-soft">{c.completed}/{c.units.length} units completed</span></div>
          {c.description && <p className="text-sm text-ink-soft">{c.description}</p>}
          <div className="mt-2 h-2 rounded-full bg-canvas" role="progressbar" aria-valuenow={c.completed} aria-valuemax={c.units.length} aria-label="Course progress"><div className="h-2 rounded-full bg-brand" style={{ width: `${c.units.length ? (c.completed / c.units.length) * 100 : 0}%` }} /></div>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {c.units.map((u) => (
              <li key={u.id}>
                <Link href={`/learn/${u.id}`} className="flex h-full flex-col gap-1 rounded-xl border border-line p-4 hover:border-brand">
                  <span className={ST[u.status][1] + " self-start"}>{ST[u.status][0]}</span>
                  <b className="text-navy">{u.title}</b>
                  {u.description && <span className="text-sm text-ink-soft">{u.description}</span>}
                  <span className="mt-auto text-xs text-ink-soft">{u.done}/{u.total} parts</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

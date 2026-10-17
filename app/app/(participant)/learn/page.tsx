"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Unit = { id: string; title: string; description: string; moduleId: string | null; status: "not_started" | "in_progress" | "completed"; done: number; total: number; locked: boolean; opensAt: string | null };
type SectionTest = { name: string; questions: number; best: number | null; passed: boolean; attempts: number; required: boolean; state: "locked" | "available" | "in_progress"; inProgressAttemptId: string | null };
const PART_LABEL: Record<string, string> = { listening_a: "Listening Part A", listening_b: "Listening Part B", listening_c: "Listening Part C", structure: "Structure", written_expression: "Written Expression", reading: "Reading" };
type Course = { part?: string | null; sectionTest?: SectionTest | null; level?: string | null; previewOnly?: boolean; inactive?: boolean; id: string; title: string; description: string; cover: string | null; locked: boolean; missing: string[]; modules: { id: string; title: string; description: string }[]; units: Unit[]; completed: number };
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ST = { not_started: ["Not started", "badge-muted"], in_progress: ["In progress", "badge-warn"], completed: ["Completed", "badge-ok"] } as const;

export default function Belajar() {
  const { data, loading, error } = useApi<{ needsPlacement: boolean; preview?: boolean; courses: Course[] }>("/api/courses");
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startErr, setStartErr] = useState("");
  async function startSectionTest(courseId: string) {
    setBusy(true); setStartErr("");
    try { const d = await api<{ attemptId: string }>(`/api/courses/${courseId}/section-test`, { json: {} }); router.push(`/test-room/${d.attemptId}`); }
    catch (e) { setStartErr((e as Error).message); setBusy(false); }
  }
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
      {data?.preview && <p role="note" className="rounded-xl border border-accent bg-accent-tint p-3 text-sm text-navy"><b>Preview mode.</b> You see courses of every level, including courses marked Preview only, with no prerequisites or unlock days. Participants only see their own level, and never see Preview only courses. Your progress here does not appear in participant reports (admin) or counts as a test account (QA).</p>}
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
                    {c.cover && <img src={c.cover} alt="" className="-mx-1 -mt-1 mb-1 h-28 w-[calc(100%+0.5rem)] rounded-xl object-cover sm:h-32" />}
                    {c.part && <span className="text-xs font-semibold text-brand">{PART_LABEL[c.part] ?? c.part}</span>}
                    <span className="flex items-center justify-between gap-2">
                      {c.locked ? <span className="badge-muted">Locked</span> : <span className={pct === 100 ? "badge-ok" : pct > 0 ? "badge-warn" : "badge-muted"}>{pct === 100 ? "Completed" : pct > 0 ? "In progress" : "Not started"}</span>}
                      <span className="text-xs text-ink-soft">{c.units.length} {c.units.length === 1 ? "unit" : "units"}</span>
                    </span>
                    {data?.preview && <span className="flex flex-wrap gap-1.5 text-xs">{c.level && <span className="badge-muted">{c.level}</span>}{c.previewOnly && <span className="badge-warn">Preview only</span>}{c.inactive && <span className="badge-muted">Inactive</span>}</span>}
                    <span className="font-display text-lg font-extrabold leading-snug text-navy">{c.title}</span>
                    {c.locked ? <span className="text-sm text-ink-soft">Finish {c.missing.join(", ")} to open this course.</span> : c.description && <span className="line-clamp-2 text-sm text-ink-soft">{c.description}</span>}
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
              {current.locked && <p className="mt-2 rounded-lg bg-canvas p-3 text-sm text-ink-soft">This course is locked. Finish {current.missing.join(", ")} first.</p>}
              {[{ id: null as string | null, title: "", description: "" }, ...current.modules].map((m) => {
                const us = current.units.filter((u) => (u.moduleId ?? null) === m.id);
                if (!us.length) return null;
                return (
                  <div key={m.id ?? "none"} className="mt-3">
                    {m.id && <div className="mb-2"><h3 className="font-display text-base font-extrabold text-navy">{m.title}</h3>{m.description && <p className="text-sm text-ink-soft">{m.description}</p>}</div>}
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {us.map((u) => {
                        const idx = current.units.indexOf(u) + 1;
                        const off = current.locked || u.locked;
                        const body = (
                          <>
                            <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink-soft">UNIT {idx}</span>{off ? <span className="badge-muted">Locked</span> : <span className={ST[u.status][1]}>{ST[u.status][0]}</span>}</span>
                            <b className="text-navy">{u.title}</b>
                            {u.description && <span className="line-clamp-2 text-sm text-ink-soft">{u.description}</span>}
                            <span className="mt-auto pt-1 text-xs text-ink-soft">{off ? (current.locked ? "Opens after the prerequisite course" : u.opensAt ? `Opens ${day(u.opensAt)}` : "Opens after you start the course") : `${u.done}/${u.total} parts`}</span>
                          </>
                        );
                        return (
                          <li key={u.id}>
                            {off
                              ? <div aria-disabled="true" className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-canvas p-4 opacity-80">{body}</div>
                              : <Link href={`/learn/${u.id}`} className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-white p-4 hover:border-brand">{body}</Link>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {current.units.length === 0 && <p className="mt-3 text-sm text-ink-soft">No units in this course yet.</p>}
              {current.sectionTest && (
                <div className="card mt-4" aria-label="Section test">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-brand">SECTION TEST{current.part ? ` · ${PART_LABEL[current.part] ?? ""}` : ""}</p>
                      <h3 className="font-display text-lg font-extrabold text-navy">{current.sectionTest.name}</h3>
                      <p className="text-sm text-ink-soft">{current.sectionTest.questions} questions · taken at the end of this course.{current.sectionTest.best != null ? ` Best: ${current.sectionTest.best}%.` : ""}{current.sectionTest.required ? " Passing it is needed to open the courses that follow." : ""}</p>
                    </div>
                    {current.sectionTest.passed && <span className="badge-ok">Passed</span>}
                  </div>
                  {current.sectionTest.state === "locked"
                    ? <p className="mt-3 text-sm text-ink-soft">Finish every unit of this course to open the section test.</p>
                    : <button className="btn-solid mt-3" disabled={busy} onClick={() => startSectionTest(current.id)}>{current.sectionTest.state === "in_progress" ? "Continue section test" : current.sectionTest.attempts > 0 ? "Retake section test" : "Start section test"}</button>}
                  <ErrorNote text={startErr} />
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

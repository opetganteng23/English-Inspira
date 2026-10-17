"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty, LineChart } from "@/components/Charts";

type A = { percent?: number | null; id: string; name: string; kind: string; status: string; finishedAt: string | null; scoreEst: number | null; sections: Record<string, number>; reportId: string | null; availableAt?: string | null };

export default function HasilList() {
  const { data, loading, error } = useApi<{ attempts: A[] }>("/api/attempts");
  const me = useApi<{ targetScore: number | null }>("/api/me");
  if (loading) return <Loading />;
  const done = (data?.attempts ?? []).filter((a) => a.status === "submitted").reverse();
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="page-title">Test Results</h1><p className="mt-1 text-ink-soft">All your test result reports, with AI analysis.</p></div>
      <ErrorNote text={error} />
      {done.length === 0 ? <Empty>No results yet. <Link href="/tests" className="font-semibold text-brand">Take your first test</Link></Empty> : (
        <>
          <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Score progress</h2><LineChart points={done.filter((a) => !a.availableAt && a.kind !== "quiz" && a.kind !== "section").map((a) => ({ label: a.name, value: a.scoreEst ?? 0 }))} target={me.data?.targetScore} /></section>
          <div className="grid gap-3 md:grid-cols-2">
            {[...done].reverse().map((a) => (
              <div key={a.id} className="card flex items-center justify-between gap-3 hover:border-brand">
                <Link href={`/results/${a.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy">{a.name}</p><p className="text-sm text-ink-soft">{a.finishedAt ? tgl(a.finishedAt) : ""}</p>
                </Link>
                <div className="flex items-center gap-3">
                  {a.availableAt
                    ? <Link href={`/results/${a.id}`} className="text-right"><p className="text-sm font-semibold text-navy">Result pending</p><p className="text-xs text-ink-soft">available {tgl(a.availableAt, true)}</p></Link>
                    : <><Link href={`/results/${a.id}`} className="text-right">{a.percent != null ? <><p className="font-display text-2xl font-extrabold text-navy">{a.percent}%</p><p className="text-xs text-ink-soft">{a.kind === "section" ? "section test" : "unit quiz"}</p></> : <><p className="font-display text-2xl font-extrabold text-navy">{a.scoreEst}</p><p className="text-xs text-ink-soft">L {a.sections.listening ?? "-"} · S {a.sections.structure ?? "-"} · R {a.sections.reading ?? "-"}</p></>}</Link>
                      <a href={`/api/attempts/${a.id}/pdf`} download className="btn-outline !min-h-[40px] !px-3 text-sm" aria-label={`Export ${a.name} as PDF`}>PDF</a></>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

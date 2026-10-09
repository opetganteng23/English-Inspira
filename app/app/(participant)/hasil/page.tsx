"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty, LineChart } from "@/components/Charts";

type A = { id: string; name: string; kind: string; status: string; finishedAt: string | null; scoreEst: number | null; sections: Record<string, number>; reportId: string | null };

export default function HasilList() {
  const { data, loading, error } = useApi<{ attempts: A[] }>("/api/attempts");
  const me = useApi<{ targetScore: number | null }>("/api/me");
  if (loading) return <Loading />;
  const done = (data?.attempts ?? []).filter((a) => a.status === "submitted").reverse();
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="page-title">Test Results</h1><p className="mt-1 text-ink-soft">All your test result reports, with AI analysis.</p></div>
      <ErrorNote text={error} />
      {done.length === 0 ? <Empty>No results yet. <Link href="/tes" className="font-semibold text-brand">Take your first test</Link></Empty> : (
        <>
          <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Score progress</h2><LineChart points={done.map((a) => ({ label: a.name, value: a.scoreEst ?? 0 }))} target={me.data?.targetScore} /></section>
          <div className="grid gap-3 md:grid-cols-2">
            {[...done].reverse().map((a) => (
              <Link key={a.id} href={`/hasil/${a.id}`} className="card flex items-center justify-between gap-3 hover:border-brand">
                <div className="min-w-0"><p className="truncate font-semibold text-navy">{a.name}</p><p className="text-sm text-ink-soft">{a.finishedAt ? tgl(a.finishedAt) : ""}</p></div>
                <div className="text-right"><p className="font-display text-2xl font-extrabold text-navy">{a.scoreEst}</p><p className="text-xs text-ink-soft">L {a.sections.listening ?? "-"} · S {a.sections.structure ?? "-"} · R {a.sections.reading ?? "-"}</p></div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

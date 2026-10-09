"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { useActiveTime } from "@/lib/use-active-time";
import { Loading, ErrorNote } from "@/components/Charts";

type U = {
  id: string; title: string; description: string; courseTitle: string; status: string; passScore: number;
  materials: { id: string; slug: string; title: string; kind: "rich" | "html"; summary: string; done: boolean; score: number | null }[];
  quiz: { name: string; questions: number; best: number | null; passed: boolean; inProgressAttemptId: string | null } | null;
};

export default function UnitPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error } = useApi<U>(`/api/units/${params.id}`);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useActiveTime("unit", data?.id ?? null);

  async function startQuiz() {
    setBusy(true); setErr("");
    try { const d = await api(`/api/units/${params.id}/quiz`, { json: {} }); router.push(`/test-room/${d.attemptId}`); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (loading) return <Loading />;
  if (!data) return <div className="card max-w-lg"><ErrorNote text={error} /><Link href="/learn" className="mt-3 block text-sm font-semibold text-brand">All courses</Link></div>;
  const allMaterials = data.materials.every((m) => m.done);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/learn" className="text-sm font-semibold text-brand">{data.courseTitle}</Link>
      <div><h1 className="page-title">{data.title}</h1>{data.description && <p className="mt-1 text-ink-soft">{data.description}</p>}{data.status === "completed" && <p className="mt-2 inline-block rounded-lg bg-success-tint px-3 py-1.5 text-sm font-semibold text-success">Unit completed</p>}</div>
      <ErrorNote text={err} />

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Required materials</h2>
        {data.materials.length ? (
          <ul className="mt-2 divide-y divide-line">
            {data.materials.map((m) => (
              <li key={m.id}>
                <Link href={`/materials/${m.slug}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
                  <span className="min-w-0"><b className="text-navy">{m.title}</b><br /><span className="text-xs text-ink-soft">{m.kind === "html" ? "Interactive exercise" : "Reading"}{m.summary ? ` · ${m.summary}` : ""}</span></span>
                  <span className={m.done ? "badge-ok" : "badge-muted"}>{m.done ? "Done" : "Not yet"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-ink-soft">This unit has no required materials.</p>}
      </section>

      {data.quiz && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Unit quiz</h2>
          <p className="text-sm text-ink-soft">{data.quiz.name} · {data.quiz.questions} questions · pass with at least {data.passScore}% correct.{data.quiz.best != null ? ` Best: ${data.quiz.best}%.` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn-solid" disabled={busy} onClick={startQuiz}>{data.quiz.inProgressAttemptId ? "Continue quiz" : data.quiz.passed ? "Retake quiz" : "Start quiz"}</button>
            {data.quiz.passed ? <span className="badge-ok">Passed</span> : !allMaterials && <span className="text-xs text-ink-soft">We recommend finishing the materials first.</span>}
          </div>
        </section>
      )}
    </div>
  );
}

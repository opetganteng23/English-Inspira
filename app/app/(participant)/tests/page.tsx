"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type T = { id: string; name: string; kind: string; totalQuestions: number; totalSec: number; unlocked: boolean; reason: string | null; inProgressAttemptId: string | null; lastScore: number | null };
type A = { id: string; name: string; kind: string; status: string; finishedAt: string | null; scoreEst: number | null; sections: Record<string, number>; reportId: string | null };
const KIND: Record<string, string> = { placement: "Placement", sim: "Simulation", practice: "Practice" };

export default function TesSaya() {
  const router = useRouter();
  const tests = useApi<{ tests: T[] }>("/api/tests");
  const hist = useApi<{ attempts: A[] }>("/api/attempts");
  const [err, setErr] = useState("");

  async function start(t: T) {
    setErr("");
    if (t.inProgressAttemptId) return router.push(`/test-room/${t.inProgressAttemptId}`);
    router.push(`/tests/prepare/${t.id}`); // timer baru berjalan setelah "Start" di halaman persiapan
  }

  return (
    <div className="flex flex-col gap-8">
      <div><h1 className="page-title">My Tests</h1><p className="mt-1 text-ink-soft">All tests you can take, have taken, and that are still locked.</p></div>
      <ErrorNote text={err || tests.error} />
      {tests.loading && <Loading />}
      <div className="grid gap-4 md:grid-cols-2">
        {tests.data?.tests.map((t) => (
          <div key={t.id} className={`card flex flex-col justify-between gap-4 ${t.unlocked ? "" : "bg-canvas"}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="badge-muted">{KIND[t.kind]}</span>{!t.unlocked && <span className="badge-muted">🔒 Locked</span>}</div>
              <h2 className="mt-2 font-display text-lg font-extrabold text-navy">{t.name}</h2>
              <p className="text-sm text-ink-soft">{t.totalQuestions} questions · about {Math.round(t.totalSec / 60)} minutes{t.lastScore ? ` · last score ${t.lastScore}` : ""}</p>
            </div>
            {t.unlocked
              ? <button onClick={() => start(t)} className="btn-solid">{t.inProgressAttemptId ? "Continue" : "Start"}</button>
              : <p className="text-sm text-ink-soft">{t.reason ?? "Not available to you yet."}</p>}
          </div>
        ))}
      </div>
      {tests.data?.tests.length === 0 && <Empty>No tests available yet.</Empty>}

      <section>
        <h2 className="font-display text-xl font-extrabold text-navy">Attempt history</h2>
        {hist.loading ? <Loading /> : hist.data?.attempts.length ? (
          <div className="table-wrap mt-3">
            <table>
              <thead><tr><th>Tests</th><th>Date</th><th>List.</th><th>Struct.</th><th>Read.</th><th>Score</th><th /></tr></thead>
              <tbody>
                {hist.data.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold text-navy">{a.name}</td><td>{a.finishedAt ? tgl(a.finishedAt) : <span className="badge-warn">In progress</span>}</td>
                    <td>{a.sections.listening ?? "-"}</td><td>{a.sections.structure ?? "-"}</td><td>{a.sections.reading ?? "-"}</td><td className="font-semibold">{a.scoreEst ?? "-"}</td>
                    <td className="whitespace-nowrap text-right">{a.status === "submitted" ? <Link href={`/results/${a.id}`} className="font-semibold text-brand">Reports</Link> : <Link href={`/test-room/${a.id}`} className="font-semibold text-brand">Continue</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-2 text-sm text-ink-soft">No history yet.</p>}
      </section>
    </div>
  );
}

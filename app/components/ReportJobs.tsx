"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { askConfirm, toast } from "@/components/Feedback";

type Job = { id: string; kind: "narratives" | "xlsx" | "pptx"; label: string; status: "running" | "done" | "failed"; total: number; done: number; ai: number; tokensIn: number; tokensOut: number; message: string | null; file: string | null; createdAt: string; finishedAt: string | null };
type Est = { scored: number; already: number; todo: number; ai: boolean; model: string; tokensIn: number; tokensOut: number };
const KIND: Record<Job["kind"], string> = { narratives: "AI narratives", xlsx: "Results (Excel)", pptx: "Executive summary (PowerPoint)" };
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

/** Laporan besar dan narasi AI dibuat di latar: tidak perlu menunggu di halaman, unduh dari daftar setelah siap (Sesi 6). */
export function ReportJobs({ testId, institutionId }: { testId: string; institutionId?: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<{ jobs: Job[] }>(`/api/admin/jobs?test=${testId}`, { silent: true }).then((d) => setJobs(d.jobs)).catch(() => {}), [testId]);
  useEffect(() => { load(); }, [load]);
  const running = jobs.some((j) => j.status === "running");
  useEffect(() => { if (!running) return; const iv = setInterval(load, 4000); return () => clearInterval(iv); }, [running, load]);

  async function start(kind: Job["kind"]) {
    setBusy(true);
    try {
      if (kind === "narratives") {
        const e = await api<Est>(`/api/admin/jobs/estimate?test=${testId}${institutionId ? `&institution=${institutionId}` : ""}`, { silent: true });
        if (e.todo === 0) { toast(`All ${e.scored} scored participants already have an AI narrative.`); return; }
        const ok = await askConfirm(
          `${e.todo} participant(s) need a narrative (${e.already} already done, skipped).\n\nModel: ${e.model}\nEstimated usage: about ${k(e.tokensIn)} input + ${k(e.tokensOut)} output tokens. The cost follows the model's price in Anthropic.${e.ai ? "" : "\n\nThe AI key is not set, so simple template narratives are written instead (no cost)."}\n\nIt runs in the background; you can leave this page.`,
          { title: "Generate AI narratives?", confirmLabel: `Generate ${e.todo}` });
        if (!ok) return;
      }
      await api("/api/admin/jobs", { json: { kind, testId, institutionId }, silent: true });
      toast("Started. It runs in the background.");
      load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  }

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-extrabold text-navy">Prepare in the background</h2>
        <p className="text-sm text-ink-soft">For large tests the direct download can time out. These are prepared in the background; download them below when ready (kept 7 days).</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" disabled={busy} onClick={() => start("xlsx")}>Prepare Excel</button>
        <button className="btn-outline" disabled={busy} onClick={() => start("pptx")}>Prepare PowerPoint</button>
        <button className="btn-outline" disabled={busy} onClick={() => start("narratives")} title="Admins only. Uses the AI API.">Generate AI narratives</button>
      </div>
      {jobs.length > 0 && (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <b className="text-navy">{KIND[j.kind]}</b> <span className="text-ink-soft">· {when(j.createdAt)}</span>
                <span className="block text-xs text-ink-soft">
                  {j.status === "running" ? (j.kind === "narratives" ? `Running: ${j.done}/${j.total}` : "Preparing…")
                    : j.status === "failed" ? <span className="text-red-700">{j.message ?? "Failed"}</span>
                    : j.kind === "narratives" ? `Done: ${j.done} written (${j.ai} by AI${j.done - j.ai ? `, ${j.done - j.ai} template` : ""}) · ${k(j.tokensIn)} in / ${k(j.tokensOut)} out tokens` : j.message ?? "Ready"}
                </span>
                {j.status === "running" && j.total > 0 && <span className="mt-1 block h-1.5 w-48 overflow-hidden rounded-full bg-canvas"><span className="block h-full bg-brand" style={{ width: `${Math.round((j.done / j.total) * 100)}%` }} /></span>}
              </span>
              {j.file && <a className="btn-solid !min-h-[36px]" href={`/api/admin/jobs/${j.id}/file`}>Download</a>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

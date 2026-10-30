"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { toast } from "@/components/Feedback";
import { Loading, ErrorNote } from "@/components/Charts";

type M = { id: string; to: string; template: string; status: "queued" | "sending" | "sent" | "failed"; tries: number; error: string | null; createdAt: string; sentAt: string | null; nextTryAt: string | null };
type Data = { counts7d: Record<string, number>; total: number; page: number; pages: number; items: M[] };
const ST: Record<M["status"], [string, string]> = { sent: ["Sent", "badge-ok"], queued: ["Waiting", "badge-muted"], sending: ["Sending", "badge-muted"], failed: ["Failed", "badge-bad"] };
const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-");
const nice = (t: string) => t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Log email (Sesi 7.2): terkirim, menunggu, gagal beserta alasannya; email gagal bisa dikirim ulang. */
export default function EmailLog() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApi<Data>(`/api/admin/emails?status=${status}&q=${encodeURIComponent(q)}&page=${page}`);
  async function retry(m: M) {
    try { await api(`/api/admin/emails/${m.id}/retry`, { method: "POST", silent: true }); toast("Queued again"); reload(); } catch (e) { toast((e as Error).message, "error"); }
  }
  const c = data?.counts7d ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="page-title">Email log</h1><p className="text-sm text-ink-soft">Every email the app sends (invitations, schedules, results, sign-in codes). Failed emails are retried automatically 5 times; after that you can resend them here. Email contents are not shown.</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["sent", "Sent"], ["queued", "Waiting"], ["failed", "Failed"]] as const).map(([k, l]) => (
          <div key={k} className="card !p-3"><p className="text-xs font-semibold tracking-wider text-ink-soft">{l.toUpperCase()} · 7 DAYS</p><p className={`font-display text-2xl font-extrabold ${k === "failed" && c[k] ? "text-red-700" : "text-navy"}`}>{(c[k] ?? 0).toLocaleString("en")}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field !h-10 w-full sm:w-72" placeholder="Search email address or type" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search emails" />
        {([["", "All"], ["failed", "Failed"], ["queued", "Waiting"], ["sent", "Sent"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setStatus(k); setPage(1); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${status === k ? "bg-navy text-white" : "bg-canvas text-ink hover:bg-brand-tint"}`}>{l}</button>
        ))}
      </div>
      {!data ? (error ? <ErrorNote text={error} /> : <Loading />) : (
        <div className="table-wrap"><table>
          <thead><tr><th>Created (WIB)</th><th>To</th><th>Type</th><th>Status</th><th>Detail</th><th /></tr></thead>
          <tbody>
            {data.items.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{when(m.createdAt)}</td><td className="max-w-[240px] truncate">{m.to}</td><td>{nice(m.template)}</td>
                <td><span className={ST[m.status][1]}>{ST[m.status][0]}</span></td>
                <td className="max-w-[320px] text-xs text-ink-soft">{m.status === "sent" ? `Sent ${when(m.sentAt)}` : m.error ? `${m.error}${m.status === "queued" ? ` · retry ${when(m.nextTryAt)}` : ""}` : m.status === "queued" ? (m.tries ? `Retry ${when(m.nextTryAt)}` : "In the queue (bulk invitations are sent in hourly batches)") : ""}</td>
                <td>{m.status === "failed" && m.template !== "otp" && m.template !== "password_reset" && <button className="font-semibold text-brand" onClick={() => retry(m)}>Resend</button>}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">No emails match.</td></tr>}
          </tbody>
        </table></div>
      )}
      {data && data.pages > 1 && (
        <div className="flex items-center gap-2 text-sm"><button className="btn-outline !min-h-[36px]" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.pages}</span><button className="btn-outline !min-h-[36px]" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>
      )}
    </div>
  );
}

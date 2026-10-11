"use client";

import { Fragment, useState } from "react";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type Item = { id: string; at: string; action: string; target: string; actor: { name: string; email: string; role: string } | null; meta: unknown };

/** Kata kunci aksi menjadi kalimat yang mudah dibaca. */
const LABEL: Record<string, string> = {
  "question.create": "Created a question", "question.update": "Edited a question", "question.delete": "Deleted a question", "question.duplicate": "Duplicated a question", "question.restore": "Restored a question version",
  "user.create": "Added an account", "user.update": "Updated an account", "user.update_identity": "Changed name, email, or phone", "user.reset_link": "Sent a password reset link", "user.temp_password": "Issued a temporary password", "user.delete": "Deleted an account",
  "data.erase": "Erased a participant's personal data", "settings.update": "Changed settings", "participant.view": "Opened a participant", "invitation.resend": "Resent an invitation",
  "question_type.create": "Added a question type", "question_type.update": "Edited a question type", "question_type.delete": "Deleted a question type",
};
const human = (a: string) => LABEL[a] ?? a.replace(/[._]/g, " ");

export default function AuditLog() {
  const [f, setF] = useState({ q: "", group: "", actor: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const qs = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
  const { data, loading, error } = useApi<{ items: Item[]; total: number; pages: number; groups: string[] }>(`/api/admin/audit?${qs}`);
  const set = (k: keyof typeof f, v: string) => { setPage(1); setF({ ...f, [k]: v }); };
  const csvHref = `/api/admin/audit?format=csv&${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Audit Log</h1><p className="text-sm text-ink-soft">A record of who changed what and when: answer keys, content, accounts, settings, and access to personal data. {data ? `${data.total} entries.` : ""}</p></div>
        <a href={csvHref} className="btn-outline">Export CSV</a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="field" aria-label="Search action or target" placeholder="Search action or target" value={f.q} onChange={(e) => set("q", e.target.value)} />
        <select className="field" aria-label="Category" value={f.group} onChange={(e) => set("group", e.target.value)}><option value="">All categories</option>{data?.groups.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <input className="field" aria-label="Actor email" placeholder="Actor email" value={f.actor} onChange={(e) => set("actor", e.target.value)} />
        <input className="field" type="date" aria-label="From date" value={f.from} onChange={(e) => set("from", e.target.value)} />
        <input className="field" type="date" aria-label="To date" value={f.to} onChange={(e) => set("to", e.target.value)} />
      </div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Target</th><th /></tr></thead>
            <tbody>
              {data?.items.map((i) => (
                <Fragment key={i.id}>
                  <tr>
                    <td className="whitespace-nowrap text-xs">{tgl(i.at, true)}</td>
                    <td className="text-xs">{i.actor ? <><b className="text-navy">{i.actor.name || i.actor.email}</b><br />{i.actor.email} · {i.actor.role}</> : <span className="text-ink-soft">System</span>}</td>
                    <td><b className="text-navy">{human(i.action)}</b><br /><code className="text-xs text-ink-soft">{i.action}</code></td>
                    <td className="max-w-[160px] truncate font-mono text-xs text-ink-soft" title={i.target}>{i.target || "-"}</td>
                    <td className="text-right">{i.meta ? <button className="text-sm font-semibold text-brand" aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? "Hide" : "Details"}</button> : null}</td>
                  </tr>
                  {open === i.id && <tr className="bg-canvas"><td colSpan={5}><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-2 text-xs">{JSON.stringify(i.meta, null, 2)}</pre></td></tr>}
                </Fragment>
              ))}
              {data?.items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No entries match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-soft"><span>Page {page} of {data?.pages ?? 1}</span><div className="flex gap-2"><button className="btn-outline !min-h-[40px]" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn-outline !min-h-[40px]" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { ErrorNote } from "@/components/Charts";

type Report = { created: number; resent: number; failed: { row: number; email: string; reason: string }[] };
type Hr = { rows: number; matched: number; updated: number; unmatchedCount: number; unmatched: string[] };

/** Impor peserta (CSV/Excel) dan undangan manual. `base` = awalan API: /api/inst atau /api/admin/institutions/<id>. */
export function ImportPanel({ base, query = "", onDone }: { base: string; query?: string; onDone?: () => void }) {
  const [emails, setEmails] = useState("");
  const [rep, setRep] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Admin pusat: file HR yang sama sekaligus mengisi data personel (cabang, tanggal lahir, jabatan) setelah peserta dibuat (Sesi 6.4).
  const canHr = base.startsWith("/api/admin/institutions/");
  const [withHr, setWithHr] = useState(true);
  const [hr, setHr] = useState<Hr | { error: string } | null>(null);
  const q = query ? `?${query}` : "";

  async function run(fn: () => Promise<Report>) {
    setBusy(true); setErr(""); setRep(null); setHr(null);
    try { setRep(await fn()); onDone?.(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const upload = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return setErr("Choose a CSV or Excel file first");
    const fd = new FormData(); fd.append("file", f);
    run(async () => {
      const r = await fetch(`${base}/import${q}`, { method: "POST", body: fd }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error ?? "Import failed");
      if (canHr && withHr && f.name.toLowerCase().endsWith(".xlsx")) {
        const p = await fetch(`${base}/personnel`, { method: "POST", body: fd }); const h = await p.json().catch(() => ({}));
        setHr(p.ok ? h : { error: h.error ?? "Personnel data was not read" });
      }
      return d;
    });
  };
  const invite = () => run(() => api<Report>(`${base}/invites${q}`, { json: { emails: emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) } }));

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-extrabold text-navy">Add participants</h2>
        <p className="text-sm text-ink-soft">Each participant uses one seat and receives an invitation email (valid for 7 days). Access ends with the institution’s contract.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-navy">Import a file</p>
          <p className="text-xs text-ink-soft">CSV/Excel with columns <b>email</b> (required), <b>given name</b>, <b>surname</b>, <b>phone</b>. A single <b>name</b> column also works.</p>
          <input ref={fileRef} type="file" aria-label="Participant file" accept=".csv,.xlsx" className="field" />
          {canHr && <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={withHr} onChange={(e) => setWithHr(e.target.checked)} /><span>Also save HR data from the same Excel file (branch, birth date, gender, job title). NIK and personal email are never stored.</span></label>}
          <button className="btn-solid self-start" disabled={busy} onClick={upload}>{busy ? "Processing…" : "Import & send invitations"}</button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-navy">Invite by email</p>
          <textarea aria-label="Email list" className="field h-24" placeholder="budi@campus.ac.id, sari@campus.ac.id" value={emails} onChange={(e) => setEmails(e.target.value)} />
          <button className="btn-outline self-start" disabled={busy || !emails.trim()} onClick={invite}>Send invitations</button>
        </div>
      </div>
      <ErrorNote text={err} />
      {hr && ("error" in hr
        ? <p role="status" className="rounded-xl bg-accent-tint p-3 text-sm text-navy">Participants imported, but HR data was not read: {hr.error}</p>
        : <div role="status" className="rounded-xl bg-canvas p-3 text-sm"><p>HR data: <b className="text-navy">{hr.matched}</b> of {hr.rows} rows matched · <b className="text-navy">{hr.updated}</b> profiles updated · <b className={hr.unmatchedCount ? "text-red-700" : "text-navy"}>{hr.unmatchedCount}</b> not matched</p>
            {hr.unmatchedCount > 0 && <p className="mt-1 text-xs text-ink-soft">Not matched: {hr.unmatched.slice(0, 10).join(", ")}{hr.unmatchedCount > 10 ? "…" : ""}. See Data quality for the full list.</p>}</div>)}
      {rep && (
        <div role="status" className="rounded-xl bg-canvas p-3 text-sm">
          <p><b className="text-navy">{rep.created}</b> new participants invited · <b className="text-navy">{rep.resent}</b> invitations resent · <b className={rep.failed.length ? "text-red-700" : "text-navy"}>{rep.failed.length}</b> failed</p>
          {rep.failed.length > 0 && <ul className="mt-2 list-disc pl-5 text-red-700">{rep.failed.slice(0, 30).map((f) => <li key={f.row + f.email}>Row {f.row}{f.email ? ` (${f.email})` : ""}: {f.reason}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

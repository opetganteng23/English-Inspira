"use client";

import { useRef, useState } from "react";
import { ErrorNote } from "@/components/Charts";

type Report = { dry: boolean; slots: number; booked: number; failed: { row: number; reason: string }[] };

/** Penentuan kelas/jadwal coaching massal dari Excel (admin). Baris dengan coach + waktu sama digabung jadi satu sesi. */
export function ScheduleImportPanel({ onDone }: { onDone?: () => void }) {
  const [rep, setRep] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(dry: boolean) {
    const f = fileRef.current?.files?.[0];
    if (!f) return setErr("Choose a CSV or Excel file first");
    setBusy(true); setErr(""); setRep(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`/api/admin/coaching/import${dry ? "?dry=1" : ""}`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Import failed");
      setRep(d);
      if (!dry) onDone?.();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-extrabold text-navy">Plot schedule from Excel</h2>
        <p className="text-sm text-ink-soft">One row per participant per session. Rows with the same coach, date, and start time are grouped into one session.
          Columns: <b>coach</b> (email), <b>date</b> (YYYY-MM-DD), <b>time</b> (HH:MM), duration (minutes, default 60), mode (online/offline), location (meeting link or room), capacity, level, title, <b>participant</b> (email).
          The same checks as self-booking still apply: coaching quota, schedule clashes, and session capacity. <a className="font-semibold text-brand" href="/api/admin/coaching/import">Download template</a>.</p>
      </div>
      <input ref={fileRef} type="file" aria-label="Schedule file" accept=".csv,.xlsx" className="field" />
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-line-strong px-4 py-2 font-semibold" disabled={busy} onClick={() => run(true)}>Check first (without saving)</button>
        <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => run(false)}>Import</button>
      </div>
      <ErrorNote text={err} />
      {rep && (
        <div role="status" className="rounded-xl bg-canvas p-3 text-sm">
          <p>{rep.dry ? "Preview: " : ""}<b className="text-navy">{rep.slots}</b> session{rep.slots === 1 ? "" : "s"} {rep.dry ? "would be created" : "created"} · <b className="text-navy">{rep.booked}</b> booking{rep.booked === 1 ? "" : "s"} {rep.dry ? "would succeed" : "made"} · <b className={rep.failed.length ? "text-red-700" : "text-navy"}>{rep.failed.length}</b> failed</p>
          {rep.failed.length > 0 && <ul className="mt-2 max-h-56 list-disc overflow-y-auto pl-5 text-red-700">{rep.failed.slice(0, 50).map((f) => <li key={f.row}>Row {f.row}: {f.reason}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

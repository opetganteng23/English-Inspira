"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { ErrorNote } from "@/components/Charts";

type Report = { created: number; resent: number; failed: { row: number; email: string; reason: string }[] };

/** Impor peserta (CSV/Excel) dan undangan manual. `base` = awalan API: /api/inst atau /api/admin/institutions/<id>. */
export function ImportPanel({ base, query = "", onDone }: { base: string; query?: string; onDone?: () => void }) {
  const [emails, setEmails] = useState("");
  const [rep, setRep] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const q = query ? `?${query}` : "";

  async function run(fn: () => Promise<Report>) {
    setBusy(true); setErr(""); setRep(null);
    try { setRep(await fn()); onDone?.(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const upload = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return setErr("Pilih file CSV atau Excel dulu");
    const fd = new FormData(); fd.append("file", f);
    run(async () => { const r = await fetch(`${base}/import${q}`, { method: "POST", body: fd }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error ?? "Gagal mengimpor"); return d; });
  };
  const invite = () => run(() => api<Report>(`${base}/invites${q}`, { json: { emails: emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) } }));

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-extrabold text-navy">Tambah peserta</h2>
        <p className="text-sm text-ink-soft">Setiap peserta memakai satu kursi dan menerima email undangan (berlaku 7 hari). Akses berakhir mengikuti kontrak institusi.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-navy">Impor file</p>
          <p className="text-xs text-ink-soft">CSV/Excel dengan kolom <b>email</b> (wajib), <b>nama</b>, <b>telepon</b>.</p>
          <input ref={fileRef} type="file" aria-label="File peserta" accept=".csv,.xlsx" className="field" />
          <button className="btn-solid self-start" disabled={busy} onClick={upload}>{busy ? "Memproses…" : "Impor & kirim undangan"}</button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-navy">Undang lewat email</p>
          <textarea aria-label="Daftar email" className="field h-24" placeholder="budi@kampus.ac.id, sari@kampus.ac.id" value={emails} onChange={(e) => setEmails(e.target.value)} />
          <button className="btn-outline self-start" disabled={busy || !emails.trim()} onClick={invite}>Kirim undangan</button>
        </div>
      </div>
      <ErrorNote text={err} />
      {rep && (
        <div role="status" className="rounded-xl bg-canvas p-3 text-sm">
          <p><b className="text-navy">{rep.created}</b> peserta baru diundang · <b className="text-navy">{rep.resent}</b> undangan dikirim ulang · <b className={rep.failed.length ? "text-red-700" : "text-navy"}>{rep.failed.length}</b> gagal</p>
          {rep.failed.length > 0 && <ul className="mt-2 list-disc pl-5 text-red-700">{rep.failed.slice(0, 30).map((f) => <li key={f.row + f.email}>Baris {f.row}{f.email ? ` (${f.email})` : ""}: {f.reason}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

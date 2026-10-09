"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { id: string; name: string | null; email: string; status: string; institution: string | null; level: string | null; scoreEst: number | null; placementDone: boolean; quota: { used: number; total: number } | null; tests: number; lastAt: string | null; lastLoginAt: string | null };
type Detail = {
  profile: { id: string; name?: string; email: string; phone?: string; status: string; institution: string | null; consentAt: string | null; lastLoginAt: string | null; createdAt: string; level: string | null; scoreEst: number | null; placementDone: boolean; placementRetakeAllowed: boolean };
  enrollment: { status: string; startsAt: string; expiresAt: string | null } | null;
  quotas: { level: string; used: number; total: number; active: boolean }[];
  attempts: { id: string; kind: string; scoreEst: number; finishedAt: string; flags: number }[];
  notes: { text: string; at: string }[];
};
const STATUS: Record<string, [string, string]> = { invited: ["Menunggu aktivasi", "badge-warn"], active: ["Aktif", "badge-ok"], disabled: ["Nonaktif", "badge-muted"] };

export default function Peserta() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const qs = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("status");
  const [init] = useState(qs ?? "");
  const eff = status || init;
  const { data, loading, error, reload } = useApi<{ participants: Row[]; total: number; pages: number }>(`/api/admin/participants?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}${eff ? `&status=${eff}` : ""}`);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Peserta</h1><p className="text-sm text-ink-soft">Semua peserta lintas institusi · {data?.total ?? 0} peserta. Peserta ditambahkan lewat menu Institusi.</p></div>
      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Cari nama atau email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="field w-auto" aria-label="Status" value={eff} onChange={(e) => { setPage(1); setStatus(e.target.value); }}><option value="">Semua status</option><option value="invited">Menunggu aktivasi</option><option value="active">Aktif</option><option value="disabled">Nonaktif</option></select>
      </div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Peserta</th><th>Status</th><th>Level</th><th>Skor</th><th>Kuota coaching</th><th>Tes</th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold text-navy">{p.name ?? "(belum ada nama)"}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.institution ? ` · ${p.institution}` : ""}</span></td>
                <td><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span></td>
                <td>{p.level ?? (p.placementDone ? "–" : "Belum placement")}</td><td>{p.scoreEst ?? "–"}</td><td>{p.quota ? `${p.quota.used}/${p.quota.total}` : "–"}</td><td>{p.tests}</td>
                <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(p.id)}>Detail</button></td>
              </tr>
            ))}
            {data?.participants.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">Tidak ada peserta.</td></tr>}
          </tbody>
        </table></div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-soft"><span>Halaman {page} dari {data?.pages ?? 1}</span><div className="flex gap-2"><button className="btn-outline !min-h-[40px]" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><button className="btn-outline !min-h-[40px]" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(page + 1)}>→</button></div></div>
      {sel && <DetailModal id={sel} onClose={() => { setSel(null); reload(); }} />}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: d, error, reload } = useApi<Detail>(`/api/admin/participants/${id}`);
  const [note, setNote] = useState("");
  const [ext, setExt] = useState({ days: 30, reason: "" });
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const run = async (body: Record<string, unknown>, ok?: string) => {
    setErr(""); setMsg("");
    try { await api(`/api/admin/participants/${id}`, { json: body }); if (ok) setMsg(ok); reload(); } catch (e) { setErr((e as Error).message); }
  };
  const p = d?.profile;

  return (
    <Modal title="Detail peserta" onClose={onClose} wide>
      {!d || !p ? <Loading text={error || "Memuat…"} /> : (
        <div className="flex flex-col gap-5 text-sm">
          <div><p className="font-display text-xl font-extrabold text-navy">{p.name ?? "(belum ada nama)"}</p><p className="text-ink-soft">{p.email}{p.phone ? ` · ${p.phone}` : ""}{p.institution ? ` · ${p.institution}` : ""} · dibuat {tgl(p.createdAt)}{p.lastLoginAt ? ` · login terakhir ${tgl(p.lastLoginAt)}` : ""}</p>
            <p className="mt-1"><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span> {p.level && <span className="badge-ok ml-1">{p.level}{p.scoreEst ? ` · ${p.scoreEst}` : ""}</span>} {p.consentAt && <span className="ml-1 text-xs text-ink-soft">setuju data {tgl(p.consentAt)}</span>}</p></div>
          <ErrorNote text={err} />
          {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-success">{msg}</p>}

          <section><h3 className="font-semibold text-navy">Akses & kuota</h3>
            <p className="text-ink-soft">{d.enrollment ? `Enrollment ${d.enrollment.status} · ${d.enrollment.expiresAt ? `berakhir ${tgl(d.enrollment.expiresAt)}` : "tanpa batas"}` : "Belum ada enrollment."}</p>
            {d.quotas.length > 0 && <ul className="mt-1">{d.quotas.map((q, i) => <li key={i}>Coaching {q.level}: {q.used}/{q.total}{q.active ? "" : " (nonaktif)"}</li>)}</ul>}
            <div className="mt-2 grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[100px_1fr_auto]"><input aria-label="Hari" className="field" type="number" min={1} max={730} value={ext.days} onChange={(e) => setExt({ ...ext, days: Number(e.target.value) })} /><input aria-label="Alasan perpanjangan" className="field" placeholder="Alasan perpanjang akses (wajib)" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} /><button className="btn-outline" disabled={ext.reason.trim().length < 3} onClick={() => run({ action: "extend_enrollment", ...ext }, "Akses diperpanjang.").then(() => setExt({ days: 30, reason: "" }))}>Perpanjang</button></div></section>

          <section><h3 className="font-semibold text-navy">Riwayat tes</h3>
            {d.attempts.length ? <ul className="mt-1">{d.attempts.map((a) => <li key={a.id} className="flex justify-between gap-3 border-b border-line py-1.5"><span>{a.kind} · {tgl(a.finishedAt)}{a.flags ? ` · ${a.flags} catatan aktivitas` : ""}</span><b>{a.scoreEst}</b></li>)}</ul> : <p className="text-ink-soft">Belum ada.</p>}</section>

          <section><h3 className="font-semibold text-navy">Tindakan</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.status === "invited" && <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "resend_invitation" }, "Undangan dikirim ulang.")}>Kirim ulang undangan</button>}
              {p.status === "disabled" ? <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "enable" }, "Akun diaktifkan.")}>Aktifkan</button> : <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "disable" }, "Akun dinonaktifkan.")}>Nonaktifkan</button>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input aria-label="Alasan" className="field" placeholder="Alasan (wajib untuk tindakan di kanan)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn-outline" disabled={!p.placementDone || p.placementRetakeAllowed || reason.trim().length < 3} onClick={() => run({ action: "allow_placement_retake", reason }, "Placement boleh diulang satu kali.")}>Izinkan ulang placement</button>
              <button className="btn-danger" disabled={reason.trim().length < 3 || !confirm("Hapus permanen data pribadi peserta ini? Tidak bisa dibatalkan.")} onClick={() => run({ action: "erase", reason }, "Data peserta dihapus.")}>Hapus data</button></div></section>

          <section><h3 className="font-semibold text-navy">Catatan admin</h3>
            <ul className="mt-1">{d.notes.map((n, i) => <li key={i} className="border-b border-line py-1.5">{n.text}<span className="ml-2 text-xs text-ink-soft">{tgl(n.at, true)}</span></li>)}</ul>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input aria-label="Catatan" className="field" placeholder="Tambah catatan…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-outline shrink-0" disabled={!note.trim()} onClick={() => run({ action: "note", text: note }).then(() => setNote(""))}>Simpan catatan</button></div></section>
        </div>
      )}
    </Modal>
  );
}

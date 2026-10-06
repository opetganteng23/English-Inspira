"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, rupiah, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { id: string; name: string | null; email: string; stage: string; institution: string | null; lastScore: number | null; target: number | null; readiness: string; status: string; orders: number; createdAt: string };
type Detail = {
  profile: { id: string; name?: string; email: string; phone?: string; targetScore?: number; goal?: string; status: string; institution: string | null; createdAt: string };
  orders: { id: string; invoiceNo?: string; status: string; total: number; items: string[]; createdAt: string }[];
  entitlements: { id: string; product: string; source: string; grants: { kind: string; ref?: string; qty: number; remaining: number }[]; expiresAt: string | null; revoked: boolean; note?: string }[];
  attempts: { id: string; kind: string; scoreEst: number; finishedAt: string; flags: number }[];
  notes: { text: string; at: string }[];
};
const READY: Record<string, string> = { Siap: "badge-ok", Hampir: "badge-warn", Belum: "badge-bad", "-": "badge-muted" };

export default function Peserta() {
  const [q, setQ] = useState(""); const [stage, setStage] = useState(""); const [page, setPage] = useState(1);
  const { data, loading, error } = useApi<{ participants: Row[]; total: number; pages: number }>(`/api/admin/participants?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}${stage ? `&stage=${stage}` : ""}`);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Peserta</h1><p className="text-sm text-ink-soft">Semua pemilik akun: free trial, pembeli, institusi · {data?.total ?? 0} peserta</p></div>
      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Cari nama atau email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="field w-auto" aria-label="Tahap" value={stage} onChange={(e) => { setPage(1); setStage(e.target.value); }}><option value="">Semua tahap</option>{["Baru", "Free trial", "Pembeli", "Journey", "Institusi"].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Peserta</th><th>Tahap</th><th>Skor terakhir</th><th>Target</th><th>Kesiapan</th><th>Pesanan</th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold text-navy">{p.name ?? "(belum ada nama)"}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.institution ? ` · ${p.institution}` : ""}</span></td>
                <td><span className="badge-muted">{p.stage}</span></td><td>{p.lastScore ?? "–"}</td><td>{p.target ?? "–"}</td><td><span className={READY[p.readiness]}>{p.readiness}</span></td><td>{p.orders}</td>
                <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(p.id)}>Detail</button></td>
              </tr>
            ))}
            {data?.participants.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">Tidak ada peserta.</td></tr>}
          </tbody>
        </table></div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-soft"><span>Halaman {page} dari {data?.pages ?? 1}</span><div className="flex gap-2"><button className="btn-outline !min-h-[40px]" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><button className="btn-outline !min-h-[40px]" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(page + 1)}>→</button></div></div>
      {sel && <DetailModal id={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: d, error, reload } = useApi<Detail>(`/api/admin/participants/${id}`);
  const products = useApi<{ products: { id: string; name: string }[] }>("/api/admin/products");
  const [note, setNote] = useState("");
  const [grant, setGrant] = useState({ productId: "", reason: "" });
  const [ext, setExt] = useState<{ id: string; days: number; reason: string } | null>(null);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr((e as Error).message); } };

  return (
    <Modal title="Detail peserta" onClose={onClose} wide>
      {!d ? <Loading text={error || "Memuat…"} /> : (
        <div className="flex flex-col gap-5 text-sm">
          <div><p className="font-display text-xl font-extrabold text-navy">{d.profile.name ?? "(belum ada nama)"}</p><p className="text-ink-soft">{d.profile.email}{d.profile.phone ? ` · ${d.profile.phone}` : ""} · target {d.profile.targetScore ?? "–"} · bergabung {tgl(d.profile.createdAt)}{d.profile.institution ? ` · ${d.profile.institution}` : ""}</p></div>
          <ErrorNote text={err} />
          <section><h3 className="font-semibold text-navy">Riwayat tes</h3>
            {d.attempts.length ? <ul className="mt-1">{d.attempts.map((a) => <li key={a.id} className="flex justify-between gap-3 border-b border-line py-1.5"><span>{a.kind} · {tgl(a.finishedAt)}{a.flags ? ` · ${a.flags} catatan aktivitas` : ""}</span><b>{a.scoreEst}</b></li>)}</ul> : <p className="text-ink-soft">Belum ada.</p>}</section>
          <section><h3 className="font-semibold text-navy">Akses</h3>
            {d.entitlements.length ? <ul className="mt-1">{d.entitlements.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"><span className={e.revoked ? "text-ink-soft line-through" : ""}><b>{e.product}</b> ({e.source}) · {e.grants.map((g) => `${g.kind}${g.ref ? `:${g.ref}` : ""} ${g.remaining}/${g.qty}`).join(", ")} · {e.expiresAt ? `s/d ${tgl(e.expiresAt)}` : "tanpa batas"}</span><button className="font-semibold text-brand" onClick={() => setExt({ id: e.id, days: 30, reason: "" })}>Perpanjang</button></li>
            ))}</ul> : <p className="text-ink-soft">Belum ada akses.</p>}
            {ext && <div className="mt-2 grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[100px_1fr_auto]"><input aria-label="Hari" className="field" type="number" min={1} max={365} value={ext.days} onChange={(e) => setExt({ ...ext, days: Number(e.target.value) })} /><input aria-label="Alasan" className="field" placeholder="Alasan (wajib)" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} /><button className="btn-solid" disabled={ext.reason.trim().length < 3} onClick={() => run(async () => { await api(`/api/admin/participants/${id}/grant`, { json: { extendId: ext.id, days: ext.days, reason: ext.reason } }); setExt(null); })}>Simpan</button></div>}
            <div className="mt-3 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_auto]"><select aria-label="Paket" className="field" value={grant.productId} onChange={(e) => setGrant({ ...grant, productId: e.target.value })}><option value="">Buka akses manual: pilih paket</option>{products.data?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Alasan" className="field" placeholder="Alasan (wajib)" value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} /><button className="btn-outline" disabled={!grant.productId || grant.reason.trim().length < 3} onClick={() => run(async () => { await api(`/api/admin/participants/${id}/grant`, { json: grant }); setGrant({ productId: "", reason: "" }); })}>Buka akses</button></div></section>
          <section><h3 className="font-semibold text-navy">Pesanan</h3>{d.orders.length ? <ul className="mt-1">{d.orders.map((o) => <li key={o.id} className="flex justify-between gap-3 border-b border-line py-1.5"><span>{o.invoiceNo ?? "—"} · {o.items.join(", ")} · {o.status}</span><b>{rupiah(o.total)}</b></li>)}</ul> : <p className="text-ink-soft">Belum ada.</p>}</section>
          <section><h3 className="font-semibold text-navy">Catatan admin</h3>
            <ul className="mt-1">{d.notes.map((n, i) => <li key={i} className="border-b border-line py-1.5">{n.text}<span className="ml-2 text-xs text-ink-soft">{tgl(n.at, true)}</span></li>)}</ul>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input aria-label="Catatan" className="field" placeholder="Tambah catatan…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-outline shrink-0" disabled={!note.trim()} onClick={() => run(async () => { await api(`/api/admin/participants/${id}`, { json: { text: note } }); setNote(""); })}>Simpan catatan</button></div></section>
        </div>
      )}
    </Modal>
  );
}

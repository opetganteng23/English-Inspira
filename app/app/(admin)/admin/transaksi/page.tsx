"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, rupiah, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type O = { id: string; invoiceNo: string | null; midtransOrderId: string; status: "pending" | "paid" | "failed" | "refunded"; total: number; voucherCode: string | null; paymentType: string | null; user: string; email: string; items: string[]; createdAt: string; paidAt: string | null; mock: boolean };
type Detail = {
  id: string; invoiceNo: string | null; midtransOrderId: string; status: "pending" | "paid" | "failed" | "refunded"; total: number; subtotal: number; discount: number; upgradeCredit: number; paymentType: string | null;
  items: { name: string; price: number }[]; history: { status: string; at: string; note?: string }[]; lastNotification?: Record<string, unknown>;
  user: { name?: string; email?: string } | null; entitlements: { id: string; grants: { kind: string; ref?: string; qty: number; remaining: number }[]; expiresAt: string | null; revoked: boolean }[];
};
const BADGE = { pending: "badge-warn", paid: "badge-ok", failed: "badge-bad", refunded: "badge-muted" } as const;
const LABEL = { pending: "Menunggu", paid: "Lunas", failed: "Gagal", refunded: "Direfund" } as const;

export default function Transaksi() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<{ orders: O[]; total: number; pages: number }>(`/api/admin/orders?page=${page}${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [sel, setSel] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Transaksi</h1><p className="text-sm text-ink-soft">Status disinkronkan dari notifikasi Midtrans · {data?.total ?? 0} transaksi</p></div><a className="btn-outline" href={`/api/admin/orders/export.xlsx${status ? `?status=${status}` : ""}`}>Ekspor Excel</a></div>
      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Cari invoice, order ID, peserta" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="field w-auto" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="Status"><option value="">Semua status</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Peserta</th><th>Produk</th><th>Total</th><th>Status</th><th>Tanggal</th><th /></tr></thead>
            <tbody>
              {data?.orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold text-navy">{o.invoiceNo ?? <span className="text-ink-soft">{o.midtransOrderId}</span>}{o.mock && <span className="badge-muted ml-1">sim</span>}</td>
                  <td>{o.user}<br /><span className="text-xs text-ink-soft">{o.email}</span></td><td className="max-w-[220px]">{o.items.join(", ")}</td><td className="whitespace-nowrap">{rupiah(o.total)}</td>
                  <td><span className={BADGE[o.status]}>{LABEL[o.status]}</span></td><td className="whitespace-nowrap">{tgl(o.createdAt)}</td>
                  <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(o.id)}>Detail</button></td>
                </tr>
              ))}
              {data?.orders.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">Tidak ada transaksi.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-soft"><span>Halaman {page} dari {data?.pages ?? 1}</span><div className="flex gap-2"><button className="btn-outline !min-h-[40px]" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><button className="btn-outline !min-h-[40px]" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(page + 1)}>→</button></div></div>
      {sel && <OrderDetail id={sel} onClose={() => setSel(null)} onChanged={reload} />}
    </div>
  );
}

function OrderDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data: o, error, reload } = useApi<Detail>(`/api/admin/orders/${id}`);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function refund() {
    setBusy(true); setErr("");
    try { await api(`/api/admin/orders/${id}/refund`, { json: { reason } }); reload(); onChanged(); setReason(""); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal title="Detail transaksi" onClose={onClose} wide>
      {!o ? <Loading text={error || "Memuat…"} /> : (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><span className={BADGE[o.status]}>{LABEL[o.status]}</span><b className="text-navy">{o.invoiceNo ?? o.midtransOrderId}</b></div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-ink-soft">Peserta</dt><dd>{o.user?.name ?? "-"} · {o.user?.email}</dd></div>
            <div><dt className="text-ink-soft">Metode</dt><dd>{o.paymentType ?? "-"}</dd></div>
            <div><dt className="text-ink-soft">Subtotal / potongan / voucher</dt><dd>{rupiah(o.subtotal)} / −{rupiah(o.upgradeCredit ?? 0)} / −{rupiah(o.discount ?? 0)}</dd></div>
            <div><dt className="text-ink-soft">Total</dt><dd className="font-bold text-navy">{rupiah(o.total)}</dd></div>
          </dl>
          <div><p className="font-semibold text-navy">Produk</p><ul className="mt-1">{o.items.map((i, n) => <li key={n}>• {i.name} ({rupiah(i.price)})</li>)}</ul></div>
          <div><p className="font-semibold text-navy">Data Midtrans</p><p className="text-ink-soft">order_id {o.midtransOrderId}{o.lastNotification ? ` · transaction_status ${String(o.lastNotification.transaction_status ?? "-")} · ${String(o.lastNotification.payment_type ?? "-")}` : " · belum ada notifikasi"}</p></div>
          <div><p className="font-semibold text-navy">Akses yang dibuka</p>{o.entitlements.length ? <ul className="mt-1">{o.entitlements.map((e) => <li key={e.id} className={e.revoked ? "text-ink-soft line-through" : ""}>• {e.grants.map((g) => `${g.kind}${g.ref ? `:${g.ref}` : ""} ${g.remaining}/${g.qty}`).join(", ")}{e.expiresAt ? ` · s/d ${tgl(e.expiresAt)}` : ""}{e.revoked ? " (dicabut)" : ""}</li>)}</ul> : <p className="text-ink-soft">Belum ada.</p>}</div>
          <div><p className="font-semibold text-navy">Riwayat status</p><ol className="mt-1 text-ink-soft">{o.history.map((h, i) => <li key={i}>{tgl(h.at, true)} · {h.status}{h.note ? ` (${h.note})` : ""}</li>)}</ol></div>
          {o.status === "paid" && (
            <div className="rounded-xl border border-red-200 p-4">
              <p className="font-semibold text-red-700">Refund & cabut akses</p>
              <p className="mt-1 text-ink-soft">Mencatat status refund dan mencabut akses dari pesanan ini. Pengembalian dana dilakukan di dashboard Midtrans.</p>
              <label className="mt-3 flex flex-col gap-1.5 font-semibold text-navy">Alasan (wajib, masuk audit log)<input className="field font-normal" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <ErrorNote text={err} />
              <button className="btn-danger mt-3" disabled={busy || reason.trim().length < 3} onClick={refund}>{busy ? "Memproses…" : "Tandai refund"}</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

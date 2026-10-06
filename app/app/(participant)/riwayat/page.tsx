"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, rupiah, tgl } from "@/lib/client";

type O = {
  id: string; invoiceNo: string | null; midtransOrderId: string; status: "pending" | "paid" | "failed" | "refunded"; total: number; discount: number;
  voucherCode: string | null; paymentType: string | null; items: { name: string; price: number }[]; createdAt: string; paidAt: string | null;
  history: { status: string; at: string; note?: string }[];
};
const BADGE = { pending: "badge-warn", paid: "badge-ok", failed: "badge-bad", refunded: "badge-muted" } as const;
const LABEL = { pending: "Menunggu", paid: "Lunas", failed: "Gagal", refunded: "Direfund" } as const;

export default function Riwayat() {
  const [orders, setOrders] = useState<O[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/orders").then((d) => setOrders(d.orders)).catch((e) => setErr(e.message)); }, []);

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Riwayat Pembelian</h1><p className="mt-1 text-ink-soft">Invoice, status pembayaran, dan produk yang terbuka dari setiap pembelian.</p></div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!orders && !err && <p className="text-ink-soft">Memuat…</p>}
      {orders?.length === 0 && <div className="card py-10 text-center"><p className="text-ink-soft">Belum ada pembelian.</p><Link href="/paket" className="btn-solid mt-4">Lihat paket tes</Link></div>}
      <ul className="flex flex-col gap-3">
        {orders?.map((o) => (
          <li key={o.id} className="card !p-0">
            <button className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left sm:p-5" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>
              <div className="min-w-0">
                <p className="font-semibold text-navy">{o.items.map((i) => i.name).join(", ")}</p>
                <p className="text-sm text-ink-soft">{o.invoiceNo ?? o.midtransOrderId} · {tgl(o.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3"><span className="font-semibold text-navy">{rupiah(o.total)}</span><span className={BADGE[o.status]}>{LABEL[o.status]}</span></div>
            </button>
            {open === o.id && (
              <div className="border-t border-line p-4 text-sm sm:p-5">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-ink-soft">Metode</dt><dd>{o.paymentType ?? "—"}</dd></div>
                  <div><dt className="text-ink-soft">Voucher</dt><dd>{o.voucherCode ? `${o.voucherCode} (−${rupiah(o.discount)})` : "—"}</dd></div>
                </dl>
                <p className="mt-4 text-xs font-semibold tracking-wide text-ink-soft">RIWAYAT STATUS</p>
                <ol className="mt-1 flex flex-col gap-1">{o.history.map((h, i) => <li key={i}>{tgl(h.at, true)} · {h.status}{h.note ? ` (${h.note})` : ""}</li>)}</ol>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {o.status === "paid" && <a className="btn-outline" href={`/api/orders/${o.id}/invoice.pdf`} target="_blank" rel="noreferrer">Unduh invoice PDF</a>}
                  {o.status === "pending" && <Link className="btn-solid" href={`/pembayaran/${o.id}`}>Lanjutkan pembayaran</Link>}
                  <Link className="btn-outline" href="/paket">Beli lagi</Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

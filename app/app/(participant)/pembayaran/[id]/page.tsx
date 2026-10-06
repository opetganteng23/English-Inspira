"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, rupiah, tgl } from "@/lib/client";
import { loadSnap } from "@/lib/snap";
import { Steps } from "@/components/Steps";

type Order = {
  id: string; invoiceNo: string | null; midtransOrderId: string; status: "pending" | "paid" | "failed" | "refunded"; total: number; subtotal: number;
  discount: number; upgradeCredit: number; voucherCode: string | null; paymentType: string | null; mock: boolean; snapToken: string | null;
  clientKey: string | null; production: boolean; items: { productId: string; name: string; price: number }[]; paidAt: string | null; expiresAt: string; createdAt: string;
};

export default function Pembayaran({ params }: { params: { id: string } }) {
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);

  const load = useCallback(() => api(`/api/orders/${params.id}`).then(setO).catch((e) => setErr(e.message)), [params.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { // polling selama menunggu
    if (o?.status !== "pending") return;
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [o?.status, load]);
  useEffect(() => {
    if (!o || o.status !== "pending") return;
    const tick = () => setLeft(Math.max(0, Math.floor((+new Date(o.expiresAt) - Date.now()) / 1000)));
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [o]);

  async function simulate(result: "paid" | "failed") {
    setBusy(true);
    try { await api(`/api/dev/pay/${params.id}`, { json: { result } }); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function check() {
    setBusy(true);
    try { await api(`/api/orders/${params.id}/check`, { json: {} }); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function resume() {
    if (!o?.snapToken || !o.clientKey) return;
    try { await loadSnap(o.clientKey, o.production); window.snap!.pay(o.snapToken, { onSuccess: load, onPending: load, onError: load, onClose: load }); }
    catch (e) { setErr((e as Error).message); }
  }

  if (err && !o) return <p role="alert" className="text-red-700">{err}</p>;
  if (!o) return <p className="text-ink-soft">Memuat…</p>;
  const hms = `${String(Math.floor(left / 3600)).padStart(2, "0")}:${String(Math.floor((left % 3600) / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div><h1 className="page-title">Pembayaran</h1><Steps current={o.status === "paid" ? 3 : 3} /></div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      {o.status === "pending" && (
        <section className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="badge-warn">MENUNGGU PEMBAYARAN</span>
            <span className="text-sm text-ink-soft">{o.invoiceNo ?? o.midtransOrderId}</span>
          </div>
          <div>
            <p className="text-sm text-ink-soft">Bayar sebelum</p>
            <p className="font-display text-3xl font-extrabold text-navy" aria-live="off">{hms}</p>
          </div>
          <p className="text-sm text-ink-soft">Jumlah tepat <b className="text-navy">{rupiah(o.total)}</b>. Status diperbarui otomatis saat Midtrans mengonfirmasi. Kamu juga akan menerima email. Halaman ini boleh ditutup.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {o.snapToken && <button className="btn-solid" onClick={resume}>Lanjutkan pembayaran</button>}
            <button className="btn-outline" disabled={busy} onClick={check}>Cek status pembayaran</button>
          </div>
          {o.mock && (
            <div className="rounded-xl border border-dashed border-accent bg-accent-tint p-4 text-sm">
              <b className="text-accent-dark">Mode simulasi (dev):</b> kunci Midtrans belum diisi. Pembayaran asli tidak terjadi.
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button className="btn-accent" disabled={busy} onClick={() => simulate("paid")}>Simulasikan bayar berhasil</button>
                <button className="btn-outline" disabled={busy} onClick={() => simulate("failed")}>Simulasikan gagal</button>
              </div>
            </div>
          )}
        </section>
      )}

      {o.status === "paid" && (
        <section className="card flex flex-col gap-4 border-success">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-xl text-white">✓</span><h2 className="font-display text-xl font-extrabold text-navy">Pembayaran berhasil</h2></div>
          <p className="text-sm text-ink-soft">{o.invoiceNo} · {rupiah(o.total)}{o.paymentType ? ` · ${o.paymentType}` : ""}{o.paidAt ? ` · ${tgl(o.paidAt, true)}` : ""}</p>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-soft">BARU TERBUKA DI AKUNMU</p>
            <ul className="mt-2 flex flex-col gap-1">{o.items.map((i) => <li key={i.productId} className="font-semibold text-navy">{i.name}</li>)}</ul>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {o.items.some((i) => /ITP/i.test(i.name)) && <Link href="/itp" className="btn-accent">Pilih jadwal sekarang</Link>}
            <a href={`/api/orders/${o.id}/invoice.pdf`} className="btn-outline" target="_blank" rel="noreferrer">Unduh invoice</a>
            <Link href="/beranda" className="btn-outline">Ke beranda</Link>
          </div>
        </section>
      )}

      {o.status === "failed" && (
        <section className="card flex flex-col gap-3 border-red-300">
          <span className="badge-bad self-start">PEMBAYARAN GAGAL / KEDALUWARSA</span>
          <p className="text-sm text-ink-soft">Tidak ada dana yang dipotong untuk pesanan ini. Kamu bisa membuat pesanan baru.</p>
          <Link href="/paket" className="btn-solid self-start">Pilih paket lagi</Link>
        </section>
      )}
      {o.status === "refunded" && (
        <section className="card"><span className="badge-muted">DIREFUND</span><p className="mt-2 text-sm text-ink-soft">Pesanan ini sudah direfund dan aksesnya dicabut.</p></section>
      )}

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Pesanan</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {o.items.map((i) => <li key={i.productId} className="flex justify-between gap-3"><span>{i.name}</span><span>{rupiah(i.price)}</span></li>)}
          {o.upgradeCredit > 0 && <li className="flex justify-between text-success"><span>Potongan upgrade</span><span>−{rupiah(o.upgradeCredit)}</span></li>}
          {o.discount > 0 && <li className="flex justify-between text-success"><span>Voucher {o.voucherCode}</span><span>−{rupiah(o.discount)}</span></li>}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold text-navy"><span>Total</span><span>{rupiah(o.total)}</span></div>
      </section>
    </div>
  );
}

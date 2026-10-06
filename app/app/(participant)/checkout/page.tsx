"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, rupiah } from "@/lib/client";
import { useCart } from "@/lib/cart";
import { Steps } from "@/components/Steps";
import { loadSnap } from "@/lib/snap";

type Priced = { items: { id: string; name: string; price: number }[]; subtotal: number; upgradeCredit: number; total: number; voucher: { code: string; discount: number } | null };

export default function Checkout() {
  const router = useRouter();
  const cart = useCart();
  const [priced, setPriced] = useState<Priced | null>(null);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/me").then((m) => setBuyer({ name: m.name ?? "", email: m.email, phone: m.phone ?? "" })).catch(() => {});
  }, []);
  useEffect(() => {
    if (!cart.ready) return;
    if (!cart.ids.length) return;
    api("/api/cart/validate", { json: { productIds: cart.ids, voucherCode: cart.voucher || undefined } }).then(setPriced).catch((e) => setErr(e.message));
  }, [cart.ready, cart.ids, cart.voucher]);

  async function pay(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const d = await api("/api/checkout", { json: { productIds: cart.ids, voucherCode: cart.voucher || undefined, buyer: { name: buyer.name, email: buyer.email, phone: buyer.phone || undefined }, agree } });
      cart.clear();
      if (d.snapToken) {
        await loadSnap(d.clientKey, d.production);
        window.snap!.pay(d.snapToken, {
          onSuccess: () => router.push(`/pembayaran/${d.orderId}`),
          onPending: () => router.push(`/pembayaran/${d.orderId}`),
          onError: () => router.push(`/pembayaran/${d.orderId}`),
          onClose: () => router.push(`/pembayaran/${d.orderId}`),
        });
        return;
      }
      router.push(`/pembayaran/${d.orderId}`);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  if (cart.ready && !cart.ids.length) return (
    <div className="card mx-auto max-w-lg py-10 text-center">
      <p className="text-ink-soft">Keranjangmu kosong.</p>
      <Link href="/paket" className="btn-solid mt-4">Lihat paket tes</Link>
    </div>
  );

  return (
    <form onSubmit={pay} className="flex flex-col gap-6">
      <div><h1 className="page-title">Checkout</h1><Steps current={2} /></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4">
            <h2 className="font-display text-lg font-extrabold text-navy">Data pembeli</h2>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Nama
              <input className="field font-normal" required value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} autoComplete="name" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Email untuk invoice
              <input className="field font-normal" type="email" required value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} autoComplete="email" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">WhatsApp (opsional)
              <input className="field font-normal" inputMode="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} autoComplete="tel" /></label>
            <p className="text-xs text-ink-soft">Data peserta tes ITP (nama sesuai KTP, dokumen) diisi setelah pembayaran saat memilih jadwal.</p>
          </section>
          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Metode pembayaran</h2>
            <p className="mt-1 text-sm text-ink-soft">Dipilih di jendela pembayaran. Diproses aman oleh Midtrans (transfer VA, e-wallet, kartu, dan lainnya).</p>
          </section>
        </div>
        <aside className="card h-fit">
          <h2 className="font-display text-lg font-extrabold text-navy">Pesanan</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {priced?.items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.name}</span><span className="shrink-0">{rupiah(i.price)}</span></li>)}
            {!!priced?.upgradeCredit && <li className="flex justify-between text-success"><span>Potongan upgrade</span><span>−{rupiah(priced.upgradeCredit)}</span></li>}
            {priced?.voucher && <li className="flex justify-between text-success"><span>Voucher {priced.voucher.code}</span><span>−{rupiah(priced.voucher.discount)}</span></li>}
          </ul>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold text-navy"><span>Total bayar</span><span>{rupiah(priced?.total ?? 0)}</span></div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Saya setuju dengan <Link className="underline" href="/syarat">Syarat & Ketentuan</Link> dan <Link className="underline" href="/refund">Kebijakan Refund</Link>.</span>
          </label>
          {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
          <button className="btn-primary mt-4" disabled={busy || !agree || !priced}>{busy ? "Memproses…" : priced?.total === 0 ? "Aktifkan gratis" : `Bayar ${rupiah(priced?.total ?? 0)}`}</button>
          <p className="mt-3 text-xs text-ink-soft">Selesaikan pembayaran dalam 24 jam. Akses terbuka otomatis setelah Midtrans mengonfirmasi.</p>
        </aside>
      </div>
    </form>
  );
}

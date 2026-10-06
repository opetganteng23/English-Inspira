"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, rupiah } from "@/lib/client";
import { useCart } from "@/lib/cart";
import { Steps } from "@/components/Steps";

type Cart = {
  items: { id: string; name: string; price: number; description?: string }[];
  subtotal: number; upgradeCredit: number; total: number;
  voucher: { code: string; discount: number } | null; voucherError: string | null;
  suggestion: { fromId: string; toId: string; toName: string; toPrice: number } | null;
};

export default function Keranjang() {
  const cart = useCart();
  const [data, setData] = useState<Cart | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => { setCode(cart.voucher); }, [cart.voucher]);
  useEffect(() => {
    if (!cart.ready) return;
    if (!cart.ids.length) { setData(null); return; }
    api("/api/cart/validate", { json: { productIds: cart.ids, voucherCode: cart.voucher || undefined } })
      .then((d) => { setData(d); setErr(""); })
      .catch((e) => setErr(e.message));
  }, [cart.ready, cart.ids, cart.voucher]);

  if (!cart.ready) return <p className="text-ink-soft">Memuat…</p>;

  if (!cart.ids.length) return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 py-10 text-center">
      <h1 className="font-display text-2xl font-extrabold text-navy">Keranjangmu kosong</h1>
      <p className="text-ink-soft">Pilih tes simulasi, pendaftaran ITP, atau paket.</p>
      <Link href="/paket" className="btn-solid">Lihat paket tes</Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Keranjang</h1>
        <Steps current={1} />
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {data?.items.map((i) => (
            <div key={i.id} className="card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-extrabold text-navy">{i.name}</h2>
                {i.description && <p className="text-sm text-ink-soft">{i.description}</p>}
                <button className="mt-2 text-sm font-semibold text-red-700" onClick={() => cart.remove(i.id)}>Hapus</button>
              </div>
              <p className="shrink-0 font-semibold text-navy">{rupiah(i.price)}</p>
            </div>
          ))}
          {data?.suggestion && (
            <div className="rounded-2xl border border-accent bg-accent-tint p-4 text-sm">
              <b className="text-accent-dark">Hemat dengan bundle.</b> Ganti ke <b>{data.suggestion.toName}</b> ({rupiah(data.suggestion.toPrice)}): dapat Tes Simulasi lagi untuk memastikan skormu siap sebelum tes resmi.
              <button className="btn-accent mt-3 w-full sm:w-auto" onClick={() => cart.replace(data.suggestion!.fromId, data.suggestion!.toId)}>Ganti ke bundle</button>
            </div>
          )}
          <Link href="/paket" className="text-sm font-semibold text-brand">← Lanjut belanja</Link>
        </div>

        <aside className="card h-fit">
          <h2 className="font-display text-lg font-extrabold text-navy">Ringkasan</h2>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); cart.setVoucher(code.trim().toUpperCase()); }}>
            <label className="sr-only" htmlFor="v">Kode voucher</label>
            <input id="v" className="field uppercase" placeholder="Kode voucher" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn-outline shrink-0">Pakai</button>
          </form>
          {data?.voucher && <p className="mt-2 text-sm text-success">✓ {data.voucher.code} dipakai</p>}
          {data?.voucherError && <p role="alert" className="mt-2 text-sm text-red-700">{data.voucherError}</p>}
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <Row k="Subtotal" v={rupiah(data?.subtotal ?? 0)} />
            {!!data?.upgradeCredit && <Row k="Potongan upgrade (pembelian sebelumnya)" v={`−${rupiah(data.upgradeCredit)}`} ok />}
            {!!data?.voucher && <Row k="Diskon voucher" v={`−${rupiah(data.voucher.discount)}`} ok />}
            <div className="mt-1 flex justify-between border-t border-line pt-3 text-base font-bold text-navy"><dt>Total</dt><dd>{rupiah(data?.total ?? 0)}</dd></div>
          </dl>
          <Link href="/checkout" aria-disabled={!data} className="btn-solid mt-4 w-full">Lanjut ke checkout</Link>
          <p className="mt-3 text-xs text-ink-soft">Produk digital, terbuka otomatis setelah pembayaran.</p>
        </aside>
      </div>
    </div>
  );
}

const Row = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => (
  <div className={`flex justify-between gap-3 ${ok ? "text-success" : ""}`}><dt>{k}</dt><dd className="shrink-0">{v}</dd></div>
);

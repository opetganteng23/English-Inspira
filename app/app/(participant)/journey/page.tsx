"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { rupiah } from "@/lib/client";
import { useCart } from "@/lib/cart";
import { useRouter } from "next/navigation";
import { Loading, ErrorNote } from "@/components/Charts";

type J = {
  steps: { key: string; title: string; desc: string; status: "done" | "open" | "locked"; href: string }[];
  counts: { done: number; open: number; locked: number }; hasJourney: boolean;
  upgrade: { productId: string; name: string; price: number; credit: number; pay: number } | null;
};
const ST = { done: { label: "Selesai", cls: "badge-ok" }, open: { label: "Terbuka", cls: "badge-warn" }, locked: { label: "Terkunci", cls: "badge-muted" } } as const;

export default function Journey() {
  const { data: j, error, loading } = useApi<J>("/api/journey");
  const cart = useCart();
  const router = useRouter();
  if (loading) return <Loading />;
  if (!j) return <ErrorNote text={error} />;
  const total = j.steps.length, pct = Math.round(((j.counts.done + j.counts.open) / total) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Journey Saya</h1>
        <p className="mt-1 text-ink-soft">English Intelligence Journey™ · tahap yang terbuka mengikuti produk yang kamu beli.</p>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold text-navy">Progres journey</h2>
          <p className="text-sm text-ink-soft"><b className="text-navy">{j.counts.done + j.counts.open}</b> dari {total} langkah terbuka · {j.counts.done} selesai · {j.counts.open} terbuka · {j.counts.locked} terkunci</p>
        </div>
        <div className="mt-3 h-3 rounded-full bg-canvas" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Langkah terbuka"><div className="h-3 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
      </section>

      <ol className="grid gap-3 sm:grid-cols-2">
        {j.steps.map((s, i) => (
          <li key={s.key} className={`card flex items-start gap-3 !p-4 ${s.status === "locked" ? "opacity-70" : ""}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display font-extrabold ${s.status === "done" ? "bg-success text-white" : s.status === "open" ? "bg-accent text-white" : "bg-line text-ink-soft"}`}>{s.status === "done" ? "✓" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-navy">{s.title}</h3><span className={ST[s.status].cls}>{ST[s.status].label}</span></div>
              <p className="text-sm text-ink-soft">{s.desc}</p>
              {s.status === "open" && <Link href={s.href} className="mt-2 inline-block text-sm font-semibold text-brand">Buka →</Link>}
            </div>
          </li>
        ))}
      </ol>

      {j.upgrade && (
        <section className="card border-brand">
          <p className="text-xs font-semibold tracking-wider text-brand">BUKA SEMUA TAHAP</p>
          <h2 className="mt-1 font-display text-xl font-extrabold text-navy">Upgrade ke {j.upgrade.name}</h2>
          {j.upgrade.credit > 0 && <p className="text-sm text-ink-soft">Pembelian Tes Simulasi dan ITP resmimu dihitung sebagai potongan.</p>}
          <dl className="mt-3 max-w-sm text-sm">
            <div className="flex justify-between py-1"><dt>Harga paket</dt><dd>{rupiah(j.upgrade.price)}</dd></div>
            {j.upgrade.credit > 0 && <div className="flex justify-between py-1 text-success"><dt>Sudah dibayar</dt><dd>−{rupiah(j.upgrade.credit)}</dd></div>}
            <div className="flex justify-between border-t border-line py-2 text-base font-bold text-navy"><dt>Tambahan</dt><dd>{rupiah(j.upgrade.pay)}</dd></div>
          </dl>
          <button className="btn-solid mt-3" onClick={() => { cart.add(j.upgrade!.productId); router.push("/keranjang"); }}>Upgrade</button>
        </section>
      )}
    </div>
  );
}

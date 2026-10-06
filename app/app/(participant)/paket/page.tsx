"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, rupiah } from "@/lib/client";
import { useCart } from "@/lib/cart";

type P = { id: string; slug: string; name: string; description: string; kind: string; price: number; highlight: boolean; badge: string | null; owned: boolean; validDays: number };

export default function Paket() {
  const router = useRouter();
  const cart = useCart();
  const [products, setProducts] = useState<P[] | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/products").then((d) => setProducts(d.products)).catch((e) => setErr(e.message)); }, []);

  async function redeem(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const d = await api("/api/institution/redeem", { json: { code } });
      setMsg({ ok: true, text: `Tergabung di ${d.institution}.${d.granted ? ` Akses "${d.granted}" terbuka.` : ""}` });
      api("/api/products").then((x) => setProducts(x.products));
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Paket Tes</h1>
        <p className="mt-1 text-ink-soft">Yang sudah kamu beli langsung terbuka. Sisanya bisa dibeli satuan atau paket.</p>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!products && !err && <p className="text-ink-soft">Memuat paket…</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {products?.map((p) => {
          const inCart = cart.ids.includes(p.id);
          return (
            <article key={p.id} className={`card flex flex-col gap-3 ${p.highlight ? "border-2 border-brand" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-extrabold leading-snug text-navy">{p.name}</h2>
                {p.owned ? <span className="badge-ok shrink-0">TERBUKA</span> : p.badge ? <span className="badge-warn shrink-0">{p.badge}</span> : null}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-ink-soft">{p.description}</p>
              <p className="font-display text-2xl font-extrabold text-navy">{rupiah(p.price)}</p>
              <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                <button className="btn-solid flex-1" onClick={() => { cart.add(p.id); router.push("/keranjang"); }}>Beli sekarang</button>
                <button className="btn-outline flex-1" disabled={inCart} onClick={() => cart.add(p.id)}>{inCart ? "Di keranjang ✓" : "+ Keranjang"}</button>
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={redeem} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <h2 className="font-display text-lg font-extrabold text-navy">Punya kode institusi?</h2>
          <p className="mb-3 text-sm text-ink-soft">Paket dari kampus atau kantor terbuka tanpa pembayaran.</p>
          <label className="sr-only" htmlFor="kode">Kode institusi</label>
          <input id="kode" className="field uppercase" placeholder="Kode institusi" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn-solid sm:w-40" disabled={busy || code.trim().length < 3}>{busy ? "Memeriksa…" : "Pakai kode"}</button>
      </form>
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}

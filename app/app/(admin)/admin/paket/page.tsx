"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, rupiah } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type G = { kind: "test" | "counselor" | "itp" | "materials"; ref?: string; qty: number };
type P = { id: string; slug: string; name: string; description?: string; kind: string; price: number; entitlements: G[]; validDays: number; highlight?: boolean; badge?: string; sort: number; active: boolean; sold: number };
type Draft = Omit<P, "sold" | "id"> & { id?: string };
const KIND: Record<string, string> = { single_sim: "Tes satuan", itp_only: "ITP saja", bundle: "Bundle", journey: "Journey" };
const GRANT: Record<string, string> = { test: "Jatah tes", counselor: "Konselor AI", itp: "Pendaftaran ITP", materials: "Materi lengkap" };
const blank = (): Omit<P, "id" | "sold"> => ({ slug: "", name: "", description: "", kind: "single_sim", price: 0, entitlements: [{ kind: "test", ref: "sim", qty: 1 }], validDays: 30, highlight: false, badge: "", sort: 10, active: true });
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Paket() {
  const { data, loading, error, reload } = useApi<{ products: P[] }>("/api/admin/products");
  const [edit, setEdit] = useState<Draft | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Paket & Harga</h1><p className="text-sm text-ink-soft">Setiap paket membuka hak akses tertentu setelah pembayaran lunas.</p></div><button className="btn-solid" onClick={() => setEdit({ ...blank() })}>+ Paket baru</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Paket</th><th>Kategori</th><th>Harga</th><th>Hak akses</th><th>Berlaku</th><th>Terjual</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data?.products.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold text-navy">{p.name}<br /><span className="text-xs font-normal text-ink-soft">{p.slug}</span></td><td>{KIND[p.kind]}</td><td className="whitespace-nowrap">{rupiah(p.price)}</td>
                  <td className="max-w-[260px] text-xs">{p.entitlements.map((g) => `${GRANT[g.kind]}${g.ref ? ` ${g.ref}` : ""}${g.kind === "counselor" ? (g.qty ? ` ${g.qty}/hari` : " tanpa batas") : g.kind === "materials" ? "" : ` ×${g.qty}`}`).join(" · ")}</td>
                  <td>{p.validDays ? `${p.validDays} hari` : "Tanpa batas"}</td><td>{p.sold}</td><td><span className={p.active ? "badge-ok" : "badge-muted"}>{p.active ? "Aktif" : "Nonaktif"}</span></td>
                  <td className="text-right"><button className="font-semibold text-brand" onClick={() => setEdit({ ...p })}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function Editor({ init, onClose, onSaved }: { init: Draft; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(init);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof P>(k: K, val: P[K]) => setV((x) => ({ ...x, [k]: val }));
  const setG = (i: number, g: Partial<G>) => set("entitlements", v.entitlements.map((x, j) => (j === i ? { ...x, ...g } : x)));
  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { slug: v.slug, name: v.name, description: v.description || undefined, kind: v.kind, price: Number(v.price), entitlements: v.entitlements.map((g) => ({ kind: g.kind, ...(g.ref ? { ref: g.ref } : {}), qty: Number(g.qty) })), validDays: Number(v.validDays), highlight: !!v.highlight, badge: v.badge || undefined, sort: Number(v.sort), active: v.active };
      await api(v.id ? `/api/admin/products/${v.id}` : "/api/admin/products", { method: v.id ? "PATCH" : "POST", json: body });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!confirm("Hapus paket ini?")) return;
    try { await api(`/api/admin/products/${v.id}`, { method: "DELETE" }); onSaved(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={v.id ? `Edit: ${init.name}` : "Paket baru"} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Nama paket<input className="field font-normal" value={v.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className={label}>Slug (unik)<input className="field font-normal" value={v.slug} onChange={(e) => set("slug", e.target.value)} placeholder="mis. sim-1" /></label>
          <label className={label}>Kategori<select className="field font-normal" value={v.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(KIND).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className={label}>Harga (Rp)<input className="field font-normal" type="number" min={0} value={v.price} onChange={(e) => set("price", Number(e.target.value))} /></label>
          <label className={label}>Masa berlaku setelah bayar (hari, 0 = tanpa batas)<input className="field font-normal" type="number" min={0} value={v.validDays} onChange={(e) => set("validDays", Number(e.target.value))} /></label>
          <label className={label}>Urutan tampil<input className="field font-normal" type="number" value={v.sort} onChange={(e) => set("sort", Number(e.target.value))} /></label>
        </div>
        <label className={label}>Deskripsi singkat<input className="field font-normal" value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></label>
        <fieldset className="rounded-xl border border-line p-4"><legend className="px-2 text-sm font-semibold text-navy">Hak akses yang dibuka</legend>
          <div className="flex flex-col gap-3">
            {v.entitlements.map((g, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_90px_auto]">
                <label className={label}>Jenis<select className="field font-normal" value={g.kind} onChange={(e) => setG(i, { kind: e.target.value as G["kind"] })}>{Object.entries(GRANT).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
                <label className={label}>{g.kind === "test" ? "Jenis tes" : "—"}<select disabled={g.kind !== "test"} className="field font-normal" value={g.ref ?? ""} onChange={(e) => setG(i, { ref: e.target.value })}><option value="">-</option><option value="sim">Simulasi</option><option value="diagnostic">Diagnostic</option><option value="prediction">Prediction</option></select></label>
                <label className={label}>{g.kind === "counselor" ? "Pesan/hari (0=∞)" : "Jumlah"}<input className="field font-normal" type="number" min={0} value={g.qty} disabled={g.kind === "materials"} onChange={(e) => setG(i, { qty: Number(e.target.value) })} /></label>
                <button type="button" className="btn-danger !min-h-[48px]" aria-label="Hapus hak akses" onClick={() => set("entitlements", v.entitlements.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="self-start text-sm font-semibold text-brand" onClick={() => set("entitlements", [...v.entitlements, { kind: "test", ref: "sim", qty: 1 }])}>+ Tambah hak akses</button>
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Lencana (opsional)<input className="field font-normal" value={v.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder="DISARANKAN" /></label>
          <div className="flex flex-col justify-end gap-2 text-sm"><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!v.highlight} onChange={(e) => set("highlight", e.target.checked)} />Sorot paket ini</label><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => set("active", e.target.checked)} />Aktif (tampil & bisa dibeli)</label></div>
        </div>
        <p className="text-xs text-ink-soft">Perubahan harga tidak memengaruhi pesanan yang sudah dibuat.</p>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">{v.id ? <button className="btn-danger" onClick={remove}>Hapus</button> : <span />}<div className="flex flex-col-reverse gap-2 sm:flex-row"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</button></div></div>
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, rupiah, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type V = { id: string; code: string; type: "percent" | "fixed"; value: number; maxUse: number; used: number; validUntil: string | null; active: boolean };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Voucher() {
  const { data, loading, error, reload } = useApi<{ vouchers: V[] }>("/api/admin/vouchers");
  const [edit, setEdit] = useState<Partial<V> | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Voucher</h1><p className="text-sm text-ink-soft">Diskon persen atau nominal. Dihitung terpakai saat pembayaran lunas.</p></div><button className="btn-solid" onClick={() => setEdit({ type: "percent", value: 10, maxUse: 0, active: true })}>+ Voucher baru</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Kode</th><th>Diskon</th><th>Terpakai</th><th>Berlaku sampai</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.vouchers.map((v) => <tr key={v.id}><td className="font-semibold text-navy">{v.code}</td><td>{v.type === "percent" ? `${v.value}%` : rupiah(v.value)}</td><td>{v.used}{v.maxUse ? ` / ${v.maxUse}` : " / ∞"}</td><td>{v.validUntil ? tgl(v.validUntil) : "Tanpa batas"}</td><td><span className={v.active ? "badge-ok" : "badge-muted"}>{v.active ? "Aktif" : "Nonaktif"}</span></td><td className="text-right"><button className="font-semibold text-brand" onClick={() => setEdit(v)}>Edit</button></td></tr>)}
            {data?.vouchers.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Belum ada voucher.</td></tr>}
          </tbody>
        </table></div>
      )}
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function Editor({ init, onClose, onSaved }: { init: Partial<V>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ code: init.code ?? "", type: init.type ?? "percent", value: init.value ?? 10, maxUse: init.maxUse ?? 0, validUntil: init.validUntil ? init.validUntil.slice(0, 10) : "", active: init.active ?? true });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try { await api(init.id ? `/api/admin/vouchers/${init.id}` : "/api/admin/vouchers", { method: init.id ? "PATCH" : "POST", json: { ...v, value: Number(v.value), maxUse: Number(v.maxUse), validUntil: v.validUntil || null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() { if (!confirm("Hapus voucher ini?")) return; try { await api(`/api/admin/vouchers/${init.id}`, { method: "DELETE" }); onSaved(); } catch (e) { setErr((e as Error).message); } }
  return (
    <Modal title={init.id ? "Edit voucher" : "Voucher baru"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Kode<input className="field font-normal uppercase" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Jenis<select className="field font-normal" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as "percent" | "fixed" })}><option value="percent">Persen (%)</option><option value="fixed">Nominal (Rp)</option></select></label>
          <label className={label}>Nilai<input className="field font-normal" type="number" min={1} value={v.value} onChange={(e) => setV({ ...v, value: Number(e.target.value) })} /></label>
          <label className={label}>Batas pemakaian (0 = ∞)<input className="field font-normal" type="number" min={0} value={v.maxUse} onChange={(e) => setV({ ...v, maxUse: Number(e.target.value) })} /></label>
          <label className={label}>Berlaku sampai<input className="field font-normal" type="date" value={v.validUntil} onChange={(e) => setV({ ...v, validUntil: e.target.value })} /></label>
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Aktif</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">{init.id ? <button className="btn-danger" onClick={remove}>Hapus</button> : <span />}<div className="flex flex-col-reverse gap-2 sm:flex-row"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</button></div></div>
      </div>
    </Modal>
  );
}

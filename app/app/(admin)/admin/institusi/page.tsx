"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, rupiah, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type I = { id: string; name: string; code: string; seats: number; seatsUsed: number; contactEmail: string; batch: string; productId: string | null; product: string | null; validUntil: string | null; active: boolean };
type Inv = { id: string; number: string; description: string; amount: number; status: "unpaid" | "paid"; dueDate: string | null };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Institusi() {
  const { data, loading, error, reload } = useApi<{ institutions: I[] }>("/api/admin/institutions");
  const [edit, setEdit] = useState<Partial<I> | null>(null);
  const [manage, setManage] = useState<I | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Institusi</h1><p className="text-sm text-ink-soft">Kampus, instansi, dan perusahaan dengan kode institusi.</p></div><button className="btn-solid" onClick={() => setEdit({ active: true, seats: 50 })}>+ Institusi baru</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Institusi</th><th>Kode</th><th>Kursi</th><th>Paket</th><th>Berlaku</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.institutions.map((i) => <tr key={i.id}><td className="font-semibold text-navy">{i.name}<br /><span className="text-xs font-normal text-ink-soft">{i.batch}</span></td><td><code>{i.code}</code></td><td>{i.seatsUsed}/{i.seats}</td><td>{i.product ?? "—"}</td><td>{i.validUntil ? tgl(i.validUntil) : "Tanpa batas"}</td><td><span className={i.active ? "badge-ok" : "badge-muted"}>{i.active ? "Aktif" : "Nonaktif"}</span></td>
              <td className="whitespace-nowrap text-right"><Link className="mr-3 font-semibold text-brand" href={`/institusi?institution=${i.id}`}>Portal</Link><button className="mr-3 font-semibold text-brand" onClick={() => setManage(i)}>Undang & tagihan</button><button className="font-semibold text-brand" onClick={() => setEdit(i)}>Edit</button></td></tr>)}
            {data?.institutions.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">Belum ada institusi.</td></tr>}
          </tbody>
        </table></div>
      )}
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {manage && <Manage inst={manage} onClose={() => setManage(null)} />}
    </div>
  );
}

function Editor({ init, onClose, onSaved }: { init: Partial<I>; onClose: () => void; onSaved: () => void }) {
  const products = useApi<{ products: { id: string; name: string }[] }>("/api/admin/products");
  const [v, setV] = useState({ name: init.name ?? "", code: init.code ?? "", seats: init.seats ?? 50, contactEmail: init.contactEmail ?? "", batch: init.batch ?? "", productId: init.productId ?? "", validUntil: init.validUntil ? init.validUntil.slice(0, 10) : "", active: init.active ?? true });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try { await api(init.id ? `/api/admin/institutions/${init.id}` : "/api/admin/institutions", { method: init.id ? "PATCH" : "POST", json: { ...v, seats: Number(v.seats), productId: v.productId || null, validUntil: v.validUntil || null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title={init.id ? "Edit institusi" : "Institusi baru"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Nama institusi<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Kode (dibagikan ke peserta)<input className="field font-normal uppercase" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></label>
          <label className={label}>Jumlah kursi<input className="field font-normal" type="number" min={0} value={v.seats} onChange={(e) => setV({ ...v, seats: Number(e.target.value) })} /></label>
          <label className={label}>Batch<input className="field font-normal" value={v.batch} onChange={(e) => setV({ ...v, batch: e.target.value })} placeholder="Batch 2026" /></label>
          <label className={label}>Berlaku sampai<input className="field font-normal" type="date" value={v.validUntil} onChange={(e) => setV({ ...v, validUntil: e.target.value })} /></label>
        </div>
        <label className={label}>Paket untuk anggota<select className="field font-normal" value={v.productId} onChange={(e) => setV({ ...v, productId: e.target.value })}><option value="">Tanpa paket (hanya tergabung)</option>{products.data?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className={label}>Email kontak<input className="field font-normal" type="email" value={v.contactEmail} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Aktif</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</button></div>
      </div>
    </Modal>
  );
}

function Manage({ inst, onClose }: { inst: I; onClose: () => void }) {
  const inv = useApi<{ invoices: Inv[] }>(`/api/admin/institutions/${inst.id}/invoices`);
  const [emails, setEmails] = useState("");
  const [res, setRes] = useState<{ email: string; ok: boolean }[] | null>(null);
  const [n, setN] = useState({ description: "", amount: "" });
  const [err, setErr] = useState("");
  async function invite() {
    setErr(""); setRes(null);
    try { const list = emails.split(/[\s,;]+/).filter(Boolean); const d = await api(`/api/admin/institutions/${inst.id}/invite`, { json: { emails: list } }); setRes(d.results); }
    catch (e) { setErr((e as Error).message); }
  }
  async function addInv() {
    setErr("");
    try { await api(`/api/admin/institutions/${inst.id}/invoices`, { json: { description: n.description, amount: Number(n.amount) } }); setN({ description: "", amount: "" }); inv.reload(); } catch (e) { setErr((e as Error).message); }
  }
  async function mark(id: string, status: "paid" | "unpaid") { try { await api(`/api/admin/institutions/${inst.id}/invoices`, { method: "PATCH", json: { invoiceId: id, status } }); inv.reload(); } catch (e) { setErr((e as Error).message); } }
  return (
    <Modal title={`${inst.name}: undangan & tagihan`} onClose={onClose} wide>
      <div className="flex flex-col gap-6 text-sm">
        <ErrorNote text={err} />
        <section><h3 className="font-semibold text-navy">Undang peserta (kode <code>{inst.code}</code>)</h3>
          <p className="text-xs text-ink-soft">Maks 100 email per kirim, pisahkan dengan koma/baris. Gmail dibatasi ±500 email/hari; untuk volume besar gunakan SMTP khusus.</p>
          <textarea className="field mt-2 h-24" placeholder="peserta1@email.com, peserta2@email.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          <button className="btn-solid mt-2" disabled={!emails.trim()} onClick={invite}>Kirim undangan</button>
          {res && <p role="status" className="mt-2 text-ink-soft">{res.filter((r) => r.ok).length} terkirim{res.some((r) => !r.ok) ? `, gagal: ${res.filter((r) => !r.ok).map((r) => r.email).join(", ")}` : ""}.</p>}</section>
        <section><h3 className="font-semibold text-navy">Tagihan</h3>
          {inv.data?.invoices.length ? <ul className="mt-1">{inv.data.invoices.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"><span>{i.number} · {i.description} · <b>{rupiah(i.amount)}</b></span><span className="flex items-center gap-2"><span className={i.status === "paid" ? "badge-ok" : "badge-warn"}>{i.status === "paid" ? "Lunas" : "Belum bayar"}</span><button className="font-semibold text-brand" onClick={() => mark(i.id, i.status === "paid" ? "unpaid" : "paid")}>{i.status === "paid" ? "Batalkan lunas" : "Tandai lunas"}</button></span></li>)}</ul> : <p className="text-ink-soft">Belum ada tagihan.</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]"><input aria-label="Deskripsi" className="field" placeholder="Deskripsi tagihan" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} /><input aria-label="Jumlah" className="field" type="number" min={0} placeholder="Jumlah (Rp)" value={n.amount} onChange={(e) => setN({ ...n, amount: e.target.value })} /><button className="btn-outline" disabled={!n.description.trim() || !n.amount} onClick={addInv}>Buat tagihan</button></div></section>
      </div>
    </Modal>
  );
}

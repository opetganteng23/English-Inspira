"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type Me = { name: string | null; email: string; phone: string | null; education: string | null; targetScore: number | null; goal: string | null; institution: { name: string; contractEnd: string | null } | null; level: { name: string } | null; scoreEst: number | null; createdAt: string; nameLocked: boolean };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Profil() {
  const router = useRouter();
  const { data: me, loading, error, reload } = useApi<Me>("/api/me");
  const [f, setF] = useState({ name: "", phone: "", education: "", targetScore: "", goal: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState("");

  useEffect(() => { if (me) setF({ name: me.name ?? "", phone: me.phone ?? "", education: me.education ?? "", targetScore: me.targetScore ? String(me.targetScore) : "", goal: me.goal ?? "" }); }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api("/api/me", { method: "PATCH", json: { ...(!me?.nameLocked && f.name ? { name: f.name } : {}), ...(f.phone ? { phone: f.phone } : {}), ...(f.education ? { education: f.education } : {}), ...(f.targetScore ? { targetScore: Number(f.targetScore) } : {}), ...(f.goal ? { goal: f.goal } : {}) } });
      setMsg({ ok: true, text: "Perubahan disimpan." }); reload();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }
  async function remove() {
    setMsg(null);
    try { const d = await api("/api/me/delete", { json: { confirm: del } }); setDel(""); setMsg({ ok: true, text: d.message }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  if (loading) return <Loading />;
  if (!me) return <ErrorNote text={error} />;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy font-display text-xl font-extrabold text-white">{(me.name ?? me.email)[0].toUpperCase()}</span>
        <div className="min-w-0"><h1 className="page-title truncate">Profil & pengaturan</h1><p className="truncate text-sm text-ink-soft">{me.email} · bergabung {tgl(me.createdAt)}</p></div>
      </div>
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <form onSubmit={save} className="card flex flex-col gap-4">
        <h2 className="font-display text-lg font-extrabold text-navy">Data diri</h2>
        <label className={label}>Nama lengkap sesuai KTP/paspor<input className="field font-normal" disabled={me.nameLocked} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />{me.nameLocked && <span className="text-xs font-normal text-ink-soft">Terkunci setelah kamu mendaftar tes ITP resmi.</span>}</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Nomor telepon<input className="field font-normal" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className={label}>Pendidikan terakhir<select className="field font-normal" value={f.education} onChange={(e) => setF({ ...f, education: e.target.value })}><option value="">Pilih</option><option value="sma">SMA/SMK</option><option value="d3">D3</option><option value="s1">S1</option><option value="s2">S2</option></select></label>
          <label className={label}>Target skor ITP<select className="field font-normal" value={f.targetScore} onChange={(e) => setF({ ...f, targetScore: e.target.value })}><option value="">Pilih</option>{[450, 500, 550, 600].map((n) => <option key={n} value={n}>{n === 600 ? "600+" : n}</option>)}</select></label>
          <label className={label}>Tujuan<select className="field font-normal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}><option value="">Pilih</option><option value="kelulusan">Syarat kelulusan</option><option value="beasiswa">Beasiswa / S2</option><option value="pekerjaan">Pekerjaan / CPNS</option><option value="lainnya">Lainnya</option></select></label>
        </div>
        <button className="btn-solid self-start" disabled={busy}>{busy ? "Menyimpan…" : "Simpan perubahan"}</button>
      </form>

      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Institusi & level</h2>
        <p className="mt-1 text-sm">{me.institution ? <>Program <b>{me.institution.name}</b>{me.institution.contractEnd ? <> · akses sampai {tgl(me.institution.contractEnd)}</> : null}.</> : "Akunmu tidak terhubung ke institusi."} {me.level ? <>Level: <b>{me.level.name}</b>{me.scoreEst ? ` (estimasi ${me.scoreEst})` : ""}.</> : "Level ditentukan setelah placement test."}</p></section>

      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Login & keamanan</h2>
        <p className="mt-1 text-sm text-ink-soft">Masuk memakai kode OTP yang dikirim ke <b>{me.email}</b>, jadi tidak ada kata sandi yang perlu diingat atau bisa bocor. Perubahan email dilakukan lewat admin.</p></section>

      <section className="card flex flex-col gap-3"><h2 className="font-display text-lg font-extrabold text-navy">Privasi</h2>
        <p className="text-sm text-ink-soft">Kami tidak merekam kamera atau mikrofon. Kamu bisa mengunduh seluruh datamu atau mengajukan penghapusan data.</p>
        <a className="btn-outline self-start" href="/api/me/export">Unduh data saya</a>
        <details className="rounded-xl border border-red-200 p-4"><summary className="cursor-pointer font-semibold text-red-700">Ajukan penghapusan data</summary>
          <p className="mt-2 text-sm text-ink-soft">Pengajuan diteruskan ke admin, yang memprosesnya lewat prosedur tercatat. Data pribadi dan percakapan Konselor akan dihapus permanen dan tidak bisa dibatalkan.</p>
          <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">Ketik HAPUS untuk konfirmasi<input className="field font-normal" value={del} onChange={(e) => setDel(e.target.value)} /></label>
          <button className="btn-danger mt-3" disabled={del !== "HAPUS"} onClick={remove}>Ajukan penghapusan</button></details>
      </section>
      <button className="self-start text-sm font-semibold text-brand" onClick={() => router.push("/bantuan")}>Butuh bantuan? →</button>
    </div>
  );
}

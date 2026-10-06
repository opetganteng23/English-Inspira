"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type C = { name: string; code: string; seats: number; used: number; validUntil: string | null; active: boolean };

export default function Kode() {
  const { url, ready } = useInstQuery();
  const { data, error } = useApi<C>(url("/api/inst/code"));
  const [emails, setEmails] = useState("");
  const [res, setRes] = useState<{ email: string; ok: boolean }[] | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ready) return <Loading />;
  if (!data) return <ErrorNote text={error} />;
  const link = typeof window !== "undefined" ? `${location.origin}/daftar` : "/daftar";

  async function invite() {
    setBusy(true); setErr(""); setRes(null);
    try { const d = await api(url("/api/inst/invite")!, { json: { emails: emails.split(/[\s,;]+/).filter(Boolean) } }); setRes(d.results); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function copy() { try { await navigator.clipboard.writeText(data!.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard tidak tersedia */ } }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div><h1 className="page-title">Kode & undangan</h1><p className="text-sm text-ink-soft">Peserta memasukkan kode saat mendaftar atau lewat menu Paket/Profil, lalu otomatis tergabung dan mendapat akses paket institusi.</p></div>
      <section className="card flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-wider text-ink-soft">KODE INSTITUSI</p>
        <div className="flex flex-wrap items-center gap-3"><code className="rounded-xl bg-canvas px-5 py-3 font-display text-3xl font-extrabold tracking-widest text-navy">{data.code}</code><button className="btn-outline" onClick={copy}>{copied ? "Tersalin ✓" : "Salin kode"}</button></div>
        <p className="text-sm text-ink-soft">Kursi terpakai <b className="text-navy">{data.used}</b> dari {data.seats}{data.validUntil ? ` · berlaku sampai ${tgl(data.validUntil)}` : ""} · {data.active ? "aktif" : <b className="text-red-700">nonaktif</b>}</p>
        <div className="h-2.5 rounded-full bg-canvas" role="progressbar" aria-valuenow={data.used} aria-valuemax={data.seats} aria-label="Kursi terpakai"><div className="h-2.5 rounded-full bg-brand" style={{ width: `${data.seats ? Math.min(100, (data.used / data.seats) * 100) : 0}%` }} /></div>
        <p className="text-sm text-ink-soft">Tautan pendaftaran: <b className="break-all text-navy">{link}</b></p>
      </section>
      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Undangan massal</h2>
        <p className="text-sm text-ink-soft">Tempel daftar email (maks 100 per kirim), pisahkan dengan koma atau baris baru. Email berisi kode dan tautan daftar.</p>
        <textarea aria-label="Daftar email" className="field h-32" placeholder="budi@kampus.ac.id, sari@kampus.ac.id" value={emails} onChange={(e) => setEmails(e.target.value)} />
        <ErrorNote text={err} />
        <button className="btn-solid self-start" disabled={busy || !emails.trim()} onClick={invite}>{busy ? "Mengirim…" : "Kirim undangan"}</button>
        {res && <p role="status" className="text-sm text-ink-soft">{res.filter((r) => r.ok).length} terkirim{res.some((r) => !r.ok) ? `, gagal: ${res.filter((r) => !r.ok).map((r) => r.email).join(", ")}` : ""}.</p>}
      </section>
    </div>
  );
}

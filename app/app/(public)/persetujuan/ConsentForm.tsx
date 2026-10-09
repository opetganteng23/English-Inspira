"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

export function ConsentForm({ email, initialName, initialPhone }: { email: string; initialName: string; initialPhone: string }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api("/api/me/consent", { json: { consent: agree, name, phone } });
      window.location.href = "/";
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-[20px] border border-line bg-white p-5 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-extrabold text-navy">Lengkapi profil & persetujuan</h1>
        <p className="text-[15px] text-ink-soft">Akun <b>{email}</b> dibuat oleh institusimu. Satu langkah terakhir sebelum mulai.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Nama lengkap sesuai KTP/paspor
        <input className="field font-normal" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="text-xs font-normal text-ink-soft">Dipakai untuk pendaftaran tes resmi dan sertifikat.</span></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Nomor telepon <span className="font-normal text-ink-soft">(opsional)</span>
        <input className="field font-normal" inputMode="tel" autoComplete="tel" pattern="[0-9+\- ]{8,20}" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Saya menyetujui pemrosesan data pribadi dan data belajar saya sesuai <Link className="underline" href="/privasi" target="_blank">Kebijakan Privasi</Link> dan <Link className="underline" href="/syarat" target="_blank">Syarat & Ketentuan</Link>, termasuk pembagian hasil belajar kepada institusi dan coach saya.</span>
      </label>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button className="btn-primary" disabled={busy || !agree || name.trim().length < 2}>{busy ? "Menyimpan…" : "Setuju & Lanjut"}</button>
    </form>
  );
}

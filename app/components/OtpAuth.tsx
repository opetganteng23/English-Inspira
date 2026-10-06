"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

const GOALS = [["kelulusan", "Syarat kelulusan"], ["beasiswa", "Beasiswa / S2"], ["pekerjaan", "Pekerjaan / CPNS"], ["lainnya", "Lainnya"]] as const;

function Form({ mode }: { mode: "masuk" | "daftar" }) {
  const next = useSearchParams().get("next");
  const daftar = mode === "daftar";
  const [step, setStep] = useState<"form" | "otp">("form");
  const [f, setF] = useState({ name: "", email: "", phone: "", target: "", goal: "", code: "", agree: false });
  const [showCode, setShowCode] = useState(false);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault(); setErr("");
    if (daftar && !f.agree) return setErr("Setujui Syarat & Ketentuan dan Kebijakan Privasi dulu.");
    setBusy(true);
    try {
      await api("/api/auth/request-otp", { json: { email: f.email } });
      setStep("otp"); setOtp(""); setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const d = await api("/api/auth/verify-otp", { json: { email: f.email, code: otp, name: f.name || undefined } });
      if (daftar) {
        // Profil disimpan setelah sesi terbit; kegagalan di sini tidak menggagalkan pendaftaran.
        await api("/api/me", { method: "PATCH", json: { ...(f.phone ? { phone: f.phone } : {}), ...(f.target ? { targetScore: Number(f.target) } : {}), ...(f.goal ? { goal: f.goal } : {}), consent: true } }).catch(() => {});
        if (f.code.trim()) await api("/api/institution/redeem", { json: { code: f.code } }).catch(() => {});
      }
      const dest = d.role === "admin" ? "/admin" : d.role === "inst_admin" ? "/institusi" : daftar ? "/tes" : "/beranda";
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : dest;
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-navy px-6 py-6 text-white lg:w-[480px] lg:gap-8 lg:px-14 lg:py-14 xl:w-[560px] xl:px-16">
        <Logo />
        <div className="hidden lg:block">
          <h1 className="mt-10 font-display text-[40px] font-extrabold leading-[1.15]">{daftar ? "Buat akun gratis, langsung coba tes mini ITP." : "Selamat datang kembali."}</h1>
          <p className="mt-4 text-base leading-[1.7] text-mist">{daftar ? "Akun gratis sudah termasuk satu kali free trial beserta laporan hasilnya." : "Lanjutkan tes, lihat hasil, atau tanya konselor AI tentang langkah berikutnya."}</p>
          {daftar && <ul className="mt-6 flex flex-col gap-2 text-mist"><li>✓ Tes mini 42 soal format TOEFL ITP</li><li>✓ Estimasi skor + skor per section</li><li>✓ 3 pertanyaan gratis ke konselor AI</li></ul>}
        </div>
        <p className="text-sm font-semibold lg:hidden">{daftar ? "Buat akun gratis & coba tes mini ITP" : "Selamat datang kembali"}</p>
        <div className="mt-auto hidden rounded-[14px] bg-navy-700 p-5 text-sm leading-relaxed text-mist lg:block">Dikembangkan oleh Inspira Teknologi bersama Telkom University dan CoE AILO.</div>
      </aside>

      <main className="flex flex-1 items-start justify-center p-4 sm:p-8 lg:items-center">
        <form onSubmit={step === "form" ? requestOtp : verify} className="flex w-full max-w-[520px] flex-col gap-5 rounded-[20px] border border-line bg-white p-5 sm:p-10">
          {step === "form" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl font-extrabold text-navy sm:text-[28px]">{daftar ? "Daftar" : "Masuk"}</h2>
                <span className="text-[15px] text-ink-soft">
                  {daftar ? <>Sudah punya akun? <Link href="/masuk" className="font-semibold">Masuk</Link></> : <>Belum punya akun? <Link href="/daftar" className="font-semibold">Daftar gratis</Link></>}
                  {" "}Kami kirim kode 6 digit ke emailmu, tanpa kata sandi.
                </span>
              </div>
              {daftar && (
                <label className={label}>Nama lengkap sesuai KTP/paspor
                  <input className="field font-normal" required minLength={2} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
                  <span className="text-xs font-normal text-ink-soft">Dipakai untuk pendaftaran tes resmi dan sertifikat.</span></label>
              )}
              <label className={label}>Email
                <input className="field font-normal" type="email" required autoComplete="email" placeholder="nama@email.com" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
              {daftar && (
                <>
                  <label className={label}>Nomor WhatsApp
                    <input className="field font-normal" inputMode="tel" autoComplete="tel" placeholder="0812…" pattern="[0-9+\- ]{8,20}" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={label}>Target skor ITP
                      <select className="field font-normal" value={f.target} onChange={(e) => set("target", e.target.value)}><option value="">Pilih target</option>{[450, 500, 550, 600].map((n) => <option key={n} value={n}>{n === 600 ? "600+" : n}</option>)}</select></label>
                    <label className={label}>Tujuan
                      <select className="field font-normal" value={f.goal} onChange={(e) => set("goal", e.target.value)}><option value="">Pilih tujuan</option>{GOALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  </div>
                  {showCode
                    ? <label className={label}>Kode institusi atau referral<input className="field font-normal uppercase" value={f.code} onChange={(e) => set("code", e.target.value)} /></label>
                    : <button type="button" className="self-start text-sm font-semibold text-brand" onClick={() => setShowCode(true)}>+ Punya kode institusi atau referral?</button>}
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={f.agree} onChange={(e) => set("agree", e.target.checked)} />
                    <span>Saya menyetujui <Link className="underline" href="/syarat" target="_blank">Syarat & Ketentuan</Link> dan <Link className="underline" href="/privasi" target="_blank">Kebijakan Privasi</Link>.</span>
                  </label>
                </>
              )}
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
              <button className="btn-primary" disabled={busy}>{busy ? "Mengirim…" : daftar ? "Buat Akun & Mulai Free Trial" : "Kirim kode OTP"}</button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl font-extrabold text-navy sm:text-[28px]">Masukkan kode</h2>
                <span className="text-[15px] leading-relaxed text-ink-soft">Kode 6 digit dikirim ke <b>{f.email}</b>. Berlaku 5 menit.</span>
              </div>
              <div className="relative">
                <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className={`flex h-14 items-center justify-center rounded-xl border-[1.5px] font-display text-2xl font-extrabold text-navy sm:h-[60px] ${i === otp.length ? "border-brand" : "border-line-strong"}`}>{otp[i] ?? ""}</span>
                  ))}
                </div>
                <input ref={otpRef} aria-label="Kode OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="absolute inset-0 h-full w-full cursor-text opacity-0"
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </div>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
              <button className="btn-primary" disabled={busy || otp.length !== 6}>{busy ? "Memeriksa…" : daftar ? "Verifikasi & Selesai" : "Masuk"}</button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button type="button" className="font-semibold text-brand" onClick={() => { setStep("form"); setErr(""); }}>← Ganti email</button>
                <button type="button" disabled={cooldown > 0 || busy} className="font-semibold text-brand disabled:text-ink-soft" onClick={() => requestOtp()}>
                  {cooldown > 0 ? `Kirim ulang dalam ${cooldown}s` : "Kirim ulang kode"}
                </button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}

export function OtpAuth({ mode }: { mode: "masuk" | "daftar" }) {
  return <Suspense><Form mode={mode} /></Suspense>;
}

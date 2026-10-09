"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

const homeOf = (role: string, consent: boolean) =>
  consent ? "/persetujuan" : role === "admin" ? "/admin" : role === "inst_admin" ? "/institusi" : role === "coach" ? "/coach" : "/beranda";

function Form() {
  const sp = useSearchParams();
  const next = sp.get("next");
  const invite = sp.get("invite") ?? sp.get("token") ?? "";
  const [step, setStep] = useState<"form" | "otp">("form");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  // Tautan undangan: isi email otomatis agar peserta tinggal meminta kode.
  useEffect(() => {
    if (!invite) return;
    api<{ email: string; institution: string | null }>(`/api/auth/invite?token=${encodeURIComponent(invite)}`)
      .then((d) => { setEmail(d.email); setInstitution(d.institution); })
      .catch((x) => setErr((x as Error).message));
  }, [invite]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault(); setErr(""); setBusy(true);
    try {
      await api("/api/auth/request-otp", { json: { email } });
      setStep("otp"); setOtp(""); setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const d = await api<{ role: string; needsConsent: boolean }>("/api/auth/verify-otp", { json: { email, code: otp, invite: invite || undefined } });
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      window.location.href = d.needsConsent ? "/persetujuan" : safeNext ?? homeOf(d.role, false);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-navy px-6 py-6 text-white lg:w-[480px] lg:gap-8 lg:px-14 lg:py-14 xl:w-[560px] xl:px-16">
        <Logo />
        <div className="hidden lg:block">
          <h1 className="mt-10 font-display text-[40px] font-extrabold leading-[1.15]">{institution ? `Selamat datang di program ${institution}.` : "Selamat datang kembali."}</h1>
          <p className="mt-4 text-base leading-[1.7] text-mist">Masuk dengan email yang didaftarkan institusimu. Kami kirim kode 6 digit, tanpa kata sandi.</p>
        </div>
        <p className="text-sm font-semibold lg:hidden">{institution ? `Program ${institution}` : "Selamat datang kembali"}</p>
        <div className="mt-auto hidden rounded-[14px] bg-navy-700 p-5 text-sm leading-relaxed text-mist lg:block">Dikembangkan oleh Inspira Teknologi bersama Telkom University dan CoE AILO.</div>
      </aside>

      <main className="flex flex-1 items-start justify-center p-4 sm:p-8 lg:items-center">
        <form onSubmit={step === "form" ? requestOtp : verify} className="flex w-full max-w-[520px] flex-col gap-5 rounded-[20px] border border-line bg-white p-5 sm:p-10">
          {step === "form" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl font-extrabold text-navy sm:text-[28px]">Masuk</h2>
                <span className="text-[15px] text-ink-soft">Akun dibuat oleh institusimu. Belum menerima undangan? Hubungi admin institusimu.</span>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Email
                <input className="field font-normal" type="email" required autoComplete="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
              <button className="btn-primary" disabled={busy}>{busy ? "Mengirim…" : "Kirim kode OTP"}</button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl font-extrabold text-navy sm:text-[28px]">Masukkan kode</h2>
                <span className="text-[15px] leading-relaxed text-ink-soft">Kode 6 digit dikirim ke <b>{email}</b>. Berlaku 5 menit.</span>
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
              <button className="btn-primary" disabled={busy || otp.length !== 6}>{busy ? "Memeriksa…" : "Masuk"}</button>
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

export function OtpAuth() {
  return <Suspense><Form /></Suspense>;
}

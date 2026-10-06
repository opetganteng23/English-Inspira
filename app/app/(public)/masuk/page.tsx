"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

function MasukForm() {
  const next = useSearchParams().get("next");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function post(url: string, body: object) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error ?? "Terjadi kesalahan");
    return data;
  }

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(""); setBusy(true);
    try {
      await post("/api/auth/request-otp", { email });
      setStep("otp"); setCode(""); setCooldown(60);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const d = await post("/api/auth/verify-otp", { email, code, name: name || undefined });
      const dest = d.role === "admin" ? "/admin" : d.role === "inst_admin" ? "/institusi" : "/beranda";
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : dest;
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[560px] shrink-0 flex-col gap-8 bg-navy px-16 py-14 text-white lg:flex">
        <Logo />
        <h1 className="mt-14 font-display text-[40px] font-extrabold leading-[1.15]">Selamat datang kembali.</h1>
        <p className="text-base leading-[1.7] text-mist">
          Lanjutkan tes, lihat hasil, atau tanya konselor AI tentang langkah berikutnya.
        </p>
        <div className="mt-auto rounded-[14px] bg-navy-700 p-5 text-sm leading-relaxed text-mist">
          Dikembangkan oleh Inspira Teknologi bersama Telkom University dan CoE AILO.
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4">
        <form
          onSubmit={step === "email" ? requestOtp : verify}
          className="flex w-full max-w-[480px] flex-col gap-5 rounded-[20px] border border-line bg-white p-6 sm:p-10"
        >
          {step === "email" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-[28px] font-extrabold text-navy">Masuk atau daftar</h2>
                <span className="text-[15px] text-ink-soft">Kami kirim kode 6 digit ke email Anda. Tanpa kata sandi.</span>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
                Email
                <input className="field font-normal" type="email" required autoComplete="email" placeholder="nama@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
                Nama lengkap <span className="font-normal text-ink-soft">(untuk akun baru)</span>
                <input className="field font-normal" type="text" autoComplete="name" placeholder="Nama Anda"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
              <button className="btn-primary" disabled={busy}>{busy ? "Mengirim…" : "Kirim kode OTP"}</button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-[28px] font-extrabold text-navy">Masukkan kode</h2>
                <span className="text-[15px] leading-relaxed text-ink-soft">Kode 6 digit dikirim ke <b>{email}</b>. Berlaku 5 menit.</span>
              </div>
              <div className="relative">
                <div className="grid grid-cols-6 gap-2.5" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className={`flex h-[60px] items-center justify-center rounded-xl border-[1.5px] font-display text-2xl font-extrabold text-navy ${
                      i === code.length ? "border-brand" : "border-line-strong"}`}>
                      {code[i] ?? ""}
                    </span>
                  ))}
                </div>
                <input ref={codeRef} aria-label="Kode OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  className="absolute inset-0 h-full w-full cursor-text opacity-0"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </div>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
              <button className="btn-primary" disabled={busy || code.length !== 6}>{busy ? "Memeriksa…" : "Masuk"}</button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="font-semibold text-brand" onClick={() => { setStep("email"); setErr(""); }}>← Ganti email</button>
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

export default function MasukPage() {
  return <Suspense><MasukForm /></Suspense>;
}

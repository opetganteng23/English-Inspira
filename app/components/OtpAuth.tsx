"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

// Halaman autentikasi: masuk (password atau kode email), daftar dengan kode institusi, lupa & reset password.

const homeOf = (role: string, consent: boolean) =>
  consent ? "/consent" : role === "admin" ? "/admin" : role === "inst_admin" ? "/institution" : role === "coach" ? "/coach" : "/home";
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

function Shell({ heading, text, children }: { heading: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-navy px-6 py-6 text-white lg:w-[480px] lg:gap-8 lg:px-14 lg:py-14 xl:w-[560px] xl:px-16">
        <Logo />
        <div className="hidden lg:block">
          <h1 className="mt-10 font-display text-[40px] font-extrabold leading-[1.15]">{heading}</h1>
          <p className="mt-4 text-base leading-[1.7] text-mist">{text}</p>
        </div>
        <p className="text-sm font-semibold lg:hidden">{heading}</p>
        <div className="mt-auto hidden rounded-[14px] bg-navy-700 p-5 text-sm leading-relaxed text-mist lg:block">Developed by Inspira Teknologi with Telkom University and CoE AILO.</div>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-start gap-4 p-4 sm:p-8 lg:justify-center">
        <div className="w-full max-w-[520px]"><Link href="/" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand hover:text-brand-dark">Back to home</Link></div>
        <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-[20px] border border-line bg-white p-5 sm:p-10">{children}</div>
      </main>
    </div>
  );
}

const Title = ({ t, s }: { t: string; s?: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <h2 className="font-display text-2xl font-extrabold text-navy sm:text-[28px]">{t}</h2>
    {s && <span className="text-[15px] leading-relaxed text-ink-soft">{s}</span>}
  </div>
);
const Err = ({ e }: { e: string }) => (e ? <p role="alert" className="text-sm text-red-700">{e}</p> : null);
const Field = ({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">{label}<input className="field font-normal" {...p} /></label>
);

function CodeInput({ value, onChange, inputRef }: { value: string; onChange: (v: string) => void; inputRef?: React.RefObject<HTMLInputElement> }) {
  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`flex h-14 items-center justify-center rounded-xl border-[1.5px] font-display text-2xl font-extrabold text-navy sm:h-[60px] ${i === value.length ? "border-brand" : "border-line-strong"}`}>{value[i] ?? ""}</span>
        ))}
      </div>
      <input ref={inputRef} aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="absolute inset-0 h-full w-full cursor-text opacity-0"
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
    </div>
  );
}

function useCooldown() {
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  return [cooldown, setCooldown] as const;
}

// ---------- Masuk ----------
function SignInForm({ admin = false }: { admin?: boolean }) {
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const invite = sp.get("invite") ?? sp.get("token") ?? "";
  const [mode, setMode] = useState<"password" | "code">(invite ? "code" : "password");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();
  const otpRef = useRef<HTMLInputElement>(null);

  // Tautan undangan: isi email otomatis agar peserta tinggal meminta kode.
  useEffect(() => {
    if (!invite) return;
    api<{ email: string; institution: string | null }>(`/api/auth/invite?token=${encodeURIComponent(invite)}`)
      .then((d) => { setEmail(d.email); setInstitution(d.institution); })
      .catch((x) => setErr((x as Error).message));
  }, [invite]);

  const go = (d: { role: string; needsConsent: boolean }) => { window.location.href = admin ? "/admin" : d.needsConsent ? "/consent" : next ?? homeOf(d.role, false); };

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { go(await api<{ role: string; needsConsent: boolean }>("/api/auth/login", { json: { email, password, ...(admin ? { adminOnly: true } : {}) } })); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
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
    try { go(await api<{ role: string; needsConsent: boolean }>("/api/auth/verify-otp", { json: { email, code: otp, invite: invite || undefined, ...(admin ? { adminOnly: true } : {}) } })); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  const tab = (m: "password" | "code", label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setStep("form"); setErr(""); }}
      className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold ${mode === m ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{label}</button>
  );

  return (
    <Shell heading={admin ? "Admin sign-in." : institution ? `Welcome to the ${institution} program.` : "Welcome back."} text={admin ? "For English Inspira administrators. This page stays available during maintenance." : "Sign in with your password, or get a 6-digit code by email. New here? Create an account with the code from your institution."}>
      {step === "otp" ? (
        <form onSubmit={verify} className="flex flex-col gap-5">
          <Title t="Enter the code" s={<>A 6-digit code was sent to <b>{email}</b>. It is in the email subject and valid for 5 minutes. If you requested several codes, use the latest one.</>} />
          <CodeInput value={otp} onChange={setOtp} inputRef={otpRef} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy || otp.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" className="font-semibold text-brand" onClick={() => { setStep("form"); setErr(""); }}>Change email</button>
            <button type="button" disabled={cooldown > 0 || busy} className="font-semibold text-brand disabled:text-ink-soft" onClick={() => requestOtp()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={mode === "password" ? loginPassword : requestOtp} className="flex flex-col gap-5">
          <Title t={admin ? "Admin sign-in" : "Sign in"} />
          <div role="tablist" className="flex gap-1 rounded-xl bg-canvas p-1">{tab("password", "Password")}{tab("code", "Email code")}</div>
          <Field label="Email" type="email" required autoComplete="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === "password" && (
            <div className="flex flex-col gap-1.5">
              <Field label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Link href="/forgot-password" className="self-end text-sm font-semibold text-brand">Forgot password?</Link>
            </div>
          )}
          <Err e={err} />
          <button className="btn-primary" disabled={busy}>{busy ? (mode === "password" ? "Signing in…" : "Sending…") : mode === "password" ? "Sign in" : "Send code"}</button>
          {!admin && <p className="text-center text-sm text-ink-soft">Don&apos;t have an account? <Link href="/register" className="font-semibold text-brand">Create an account</Link></p>}
        </form>
      )}
    </Shell>
  );
}

// ---------- Daftar ----------
function RegisterForm() {
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", code: "" });
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();
  const otpRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e?: React.FormEvent) {
    e?.preventDefault(); setErr("");
    if (f.password !== f.confirm) { setErr("The passwords do not match"); return; }
    setBusy(true);
    try {
      await api("/api/auth/register", { json: { name: f.name, email: f.email, password: f.password, code: f.code } });
      setStep("otp"); setOtp(""); setCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const d = await api<{ role: string; needsConsent: boolean }>("/api/auth/register/verify", { json: { email: f.email, code: otp } });
      window.location.href = homeOf(d.role, d.needsConsent);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <Shell heading="Create your account." text="Use the institution code from your campus, agency, or company. Your account is ready right after you verify your email.">
      {step === "otp" ? (
        <form onSubmit={verify} className="flex flex-col gap-5">
          <Title t="Verify your email" s={<>We sent a 6-digit code to <b>{f.email}</b>. It is in the email subject and valid for 5 minutes. If this email already has an account, we sent sign-in instructions instead.</>} />
          <CodeInput value={otp} onChange={setOtp} inputRef={otpRef} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy || otp.length !== 6}>{busy ? "Checking…" : "Verify and continue"}</button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" className="font-semibold text-brand" onClick={() => { setStep("form"); setErr(""); }}>Edit details</button>
            <button type="button" disabled={cooldown > 0 || busy} className="font-semibold text-brand disabled:text-ink-soft" onClick={() => submit()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Title t="Create an account" s="All fields are required." />
          <Field label="Full name" required autoComplete="name" value={f.name} onChange={set("name")} />
          <Field label="Email" type="email" required autoComplete="email" placeholder="name@email.com" value={f.email} onChange={set("email")} />
          <Field label="Password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={f.password} onChange={set("password")} />
          <Field label="Confirm password" type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={set("confirm")} />
          <Field label="Institution code" required autoCapitalize="characters" placeholder="Ask your institution" value={f.code} onChange={set("code")} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy}>{busy ? "Sending code…" : "Create account"}</button>
          <p className="text-center text-sm text-ink-soft">Already have an account? <Link href="/sign-in" className="font-semibold text-brand">Sign in</Link></p>
        </form>
      )}
    </Shell>
  );
}

// ---------- Lupa password ----------
function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api("/api/auth/forgot-password", { json: { email } }); setSent(true); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Shell heading="Forgot your password?" text="We will email you a link to set a new one. The link is valid for 30 minutes.">
      {sent ? (
        <div className="flex flex-col gap-5">
          <Title t="Check your email" s={<>If <b>{email}</b> has an active account, a reset link is on its way. Check your spam folder too.</>} />
          <Link href="/sign-in" className="btn-primary text-center">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Title t="Reset password" s="Enter the email you use to sign in." />
          <Field label="Email" type="email" required autoComplete="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          <p className="text-center text-sm text-ink-soft">Remembered it? <Link href="/sign-in" className="font-semibold text-brand">Sign in</Link></p>
        </form>
      )}
    </Shell>
  );
}

// ---------- Reset password ----------
function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [f, setF] = useState({ password: "", confirm: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (f.password !== f.confirm) { setErr("The passwords do not match"); return; }
    setBusy(true);
    try { await api("/api/auth/reset-password", { json: { token, password: f.password } }); setDone(true); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Shell heading="Set a new password." text="Choose a password of at least 8 characters that you do not use elsewhere.">
      {done ? (
        <div className="flex flex-col gap-5">
          <Title t="Password updated" s="You can now sign in with your new password." />
          <Link href="/sign-in" className="btn-primary text-center">Sign in</Link>
        </div>
      ) : !token ? (
        <div className="flex flex-col gap-5">
          <Title t="Link not valid" s="Open the link from the reset email, or request a new one." />
          <Link href="/forgot-password" className="btn-primary text-center">Request a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Title t="New password" />
          <Field label="New password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Field label="Confirm new password" type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </Shell>
  );
}

export function OtpAuth() { return <Suspense><SignInForm /></Suspense>; }
export function AdminSignIn() { return <Suspense><SignInForm admin /></Suspense>; }
export function RegisterPage() { return <Suspense><RegisterForm /></Suspense>; }
export function ForgotPasswordPage() { return <Suspense><ForgotForm /></Suspense>; }
export function ResetPasswordPage() { return <Suspense><ResetForm /></Suspense>; }

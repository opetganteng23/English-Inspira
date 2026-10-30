"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";
import { roleHome } from "@/lib/role-home";
import { Captcha, type CaptchaValue } from "@/components/Captcha";

// Halaman autentikasi: masuk dengan password + pemeriksaan keamanan (captcha), daftar dengan kode institusi,
// buat password dari tautan undangan, lupa & reset password. Kode email hanya tersisa di halaman masuk admin.

const homeOf = (role: string, consent: boolean) =>
  consent ? "/consent" : roleHome(role);
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

function Shell({ heading, text, children }: { heading: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="brand-panel brand-auth flex shrink-0 flex-col gap-4 px-6 py-6 lg:w-[480px] lg:gap-8 lg:px-14 lg:py-14 xl:w-[560px] xl:px-16">
        <Logo />
        <div className="hidden lg:block">
          <h1 className="mt-10 font-display text-[40px] font-extrabold leading-[1.15]">{heading}</h1>
          <p className="bp-muted mt-4 text-base leading-[1.7] text-mist">{text}</p>
        </div>
        <p className="text-sm font-semibold lg:hidden">{heading}</p>
        <div className="bp-card mt-auto hidden rounded-[14px] bg-navy-700 p-5 text-sm leading-relaxed text-mist lg:block">Developed by Inspira Teknologi with Telkom University and CoE AILO.</div>
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
  const [mode, setMode] = useState<"password" | "code">("password");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaValue>(null);
  const [reload, setReload] = useState(0);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();
  const otpRef = useRef<HTMLInputElement>(null);

  const go = (d: { role: string; needsConsent: boolean }) => { window.location.href = admin ? roleHome(d.role) : d.needsConsent ? "/consent" : next ?? homeOf(d.role, false); };

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!captcha) { setErr("Complete the security check first"); return; }
    setBusy(true);
    try { go(await api<{ role: string; needsConsent: boolean }>("/api/auth/login", { json: { email, password, captcha, ...(admin ? { adminOnly: true } : {}) }, silent: true })); }
    catch (x) { setErr((x as Error).message); setBusy(false); setReload((n) => n + 1); }
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
    try { go(await api<{ role: string; needsConsent: boolean }>("/api/auth/verify-otp", { json: { email, code: otp, adminOnly: true } })); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  if (invite && !admin) return <AcceptInvite token={invite} />;

  const tab = (m: "password" | "code", label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setStep("form"); setErr(""); }}
      className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold ${mode === m ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{label}</button>
  );

  return (
    <Shell heading={admin ? "Admin sign-in." : "Welcome back."} text={admin ? "For English Inspira AI administrators. This page stays available during maintenance." : "Sign in with your email and password. Invited by your institution? Open the link in your invitation email to create your password. New here? Create an account with the code from your institution."}>
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
          {admin && <div role="tablist" className="flex gap-1 rounded-xl bg-canvas p-1">{tab("password", "Password")}{tab("code", "Email code")}</div>}
          <Field label="Email" type="email" required autoComplete="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === "password" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Field label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <span className="flex justify-between gap-2 text-sm font-semibold"><Link href="/support" className="text-ink-soft hover:text-brand">Need help?</Link><Link href="/forgot-password" className="text-brand">Forgot password?</Link></span>
              </div>
              <Captcha onChange={setCaptcha} reload={reload} />
            </>
          )}
          <Err e={err} />
          <button className="btn-primary" disabled={busy || (mode === "password" && !captcha)}>{busy ? (mode === "password" ? "Signing in…" : "Sending…") : mode === "password" ? "Sign in" : "Send code"}</button>
          {!admin && <p className="text-center text-sm text-ink-soft">Don&apos;t have an account? <Link href="/register" className="font-semibold text-brand">Create an account</Link></p>}
        </form>
      )}
    </Shell>
  );
}

// ---------- Undangan: buat password ----------
function AcceptInvite({ token }: { token: string }) {
  const [info, setInfo] = useState<{ email: string; institution: string | null } | null>(null);
  const [f, setF] = useState({ password: "", confirm: "" });
  const [captcha, setCaptcha] = useState<CaptchaValue>(null);
  const [reload, setReload] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ email: string; institution: string | null }>(`/api/auth/invite?token=${encodeURIComponent(token)}`).then(setInfo).catch((x) => setErr((x as Error).message));
  }, [token]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (f.password !== f.confirm) { setErr("The passwords do not match"); return; }
    if (!captcha) { setErr("Complete the security check first"); return; }
    setBusy(true);
    try { const d = await api<{ role: string; needsConsent: boolean }>("/api/auth/invite", { json: { token, password: f.password, captcha }, silent: true }); window.location.href = homeOf(d.role, d.needsConsent); }
    catch (x) { setErr((x as Error).message); setBusy(false); setReload((n) => n + 1); }
  }
  return (
    <Shell heading={info?.institution ? `Welcome to the ${info.institution} program.` : "Welcome."} text="Create your password to finish setting up your account. Next time, sign in with your email and this password.">
      {!info ? (
        <div className="flex flex-col gap-5">
          <Title t={err ? "Invitation not valid" : "Checking your invitation…"} s={err || undefined} />
          {err && <Link href="/sign-in" className="btn-primary text-center">Go to sign in</Link>}
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Title t="Create your password" s={<>For <b>{info.email}</b></>} />
          <Field label="Password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Field label="Confirm password" type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          <Captcha onChange={setCaptcha} reload={reload} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy || !captcha}>{busy ? "Saving…" : "Create password and continue"}</button>
        </form>
      )}
    </Shell>
  );
}

// ---------- Daftar ----------
function RegisterForm() {
  const [f, setF] = useState({ givenName: "", surname: "", email: "", password: "", confirm: "", code: "" });
  const [captcha, setCaptcha] = useState<CaptchaValue>(null);
  const [reload, setReload] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (f.password !== f.confirm) { setErr("The passwords do not match"); return; }
    if (!captcha) { setErr("Complete the security check first"); return; }
    setBusy(true);
    try {
      const d = await api<{ role: string; needsConsent: boolean }>("/api/auth/register", { json: { givenName: f.givenName, surname: f.surname, email: f.email, password: f.password, code: f.code, captcha }, silent: true });
      window.location.href = homeOf(d.role, d.needsConsent);
    } catch (x) { setErr((x as Error).message); setBusy(false); setReload((n) => n + 1); }
  }

  return (
    <Shell heading="Create your account." text="Use the institution code from your campus, agency, or company. Your account is ready right away. Make sure your email is correct: password resets and reminders are sent there.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Title t="Create an account" s="All fields are required." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Given name" required autoComplete="given-name" value={f.givenName} onChange={set("givenName")} />
          <Field label="Surname" required autoComplete="family-name" value={f.surname} onChange={set("surname")} />
        </div>
        <Field label="Email" type="email" required autoComplete="email" placeholder="name@email.com" value={f.email} onChange={set("email")} />
        <Field label="Password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={f.password} onChange={set("password")} />
        <Field label="Confirm password" type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={set("confirm")} />
        <Field label="Institution code" required autoCapitalize="characters" placeholder="Ask your institution" value={f.code} onChange={set("code")} />
        <Captcha onChange={setCaptcha} reload={reload} />
        <Err e={err} />
        <button className="btn-primary" disabled={busy || !captcha}>{busy ? "Creating account…" : "Create account"}</button>
        <p className="text-center text-sm text-ink-soft">Already have an account? <Link href="/sign-in" className="font-semibold text-brand">Sign in</Link></p>
      </form>
    </Shell>
  );
}

// ---------- Lupa password ----------
function ForgotForm() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaValue>(null);
  const [reload, setReload] = useState(0);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api("/api/auth/forgot-password", { json: { email, captcha }, silent: true }); setSent(true); }
    catch (x) { setErr((x as Error).message); setReload((n) => n + 1); } finally { setBusy(false); }
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
          <Captcha onChange={setCaptcha} reload={reload} />
          <Err e={err} />
          <button className="btn-primary" disabled={busy || !captcha}>{busy ? "Sending…" : "Send reset link"}</button>
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

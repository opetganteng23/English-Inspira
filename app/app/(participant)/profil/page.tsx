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
      setMsg({ ok: true, text: "Changes saved." }); reload();
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
        <div className="min-w-0"><h1 className="page-title truncate">Profile & settings</h1><p className="truncate text-sm text-ink-soft">{me.email} · bergabung {tgl(me.createdAt)}</p></div>
      </div>
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <form onSubmit={save} className="card flex flex-col gap-4">
        <h2 className="font-display text-lg font-extrabold text-navy">Personal details</h2>
        <label className={label}>Full name as on ID card/passport<input className="field font-normal" disabled={me.nameLocked} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />{me.nameLocked && <span className="text-xs font-normal text-ink-soft">Locked after you register for the official ITP test.</span>}</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Phone number<input className="field font-normal" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className={label}>Highest education<select className="field font-normal" value={f.education} onChange={(e) => setF({ ...f, education: e.target.value })}><option value="">Choose</option><option value="sma">SMA/SMK</option><option value="d3">D3</option><option value="s1">S1</option><option value="s2">S2</option></select></label>
          <label className={label}>ITP target score<select className="field font-normal" value={f.targetScore} onChange={(e) => setF({ ...f, targetScore: e.target.value })}><option value="">Choose</option>{[450, 500, 550, 600].map((n) => <option key={n} value={n}>{n === 600 ? "600+" : n}</option>)}</select></label>
          <label className={label}>Goal<select className="field font-normal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}><option value="">Choose</option><option value="kelulusan">Graduation requirement</option><option value="beasiswa">Scholarship / Master’s</option><option value="pekerjaan">Job / Civil service</option><option value="lainnya">Other</option></select></label>
        </div>
        <button className="btn-solid self-start" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form>

      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Institution & level</h2>
        <p className="mt-1 text-sm">{me.institution ? <>Program <b>{me.institution.name}</b>{me.institution.contractEnd ? <> · access until {tgl(me.institution.contractEnd)}</> : null}.</> : "Your account is not linked to an institution."} {me.level ? <>Level: <b>{me.level.name}</b>{me.scoreEst ? ` (estimate ${me.scoreEst})` : ""}.</> : "Your level is set after the placement test."}</p></section>

      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Login & keamanan</h2>
        <p className="mt-1 text-sm text-ink-soft">Sign in using the OTP code sent to <b>{me.email}</b>, so there is no password to remember or leak. Email changes are handled by the admin.</p></section>

      <section className="card flex flex-col gap-3"><h2 className="font-display text-lg font-extrabold text-navy">Privacy</h2>
        <p className="text-sm text-ink-soft">We never record your camera or microphone. You can download all your data or request data deletion.</p>
        <a className="btn-outline self-start" href="/api/me/export">Download my data</a>
        <details className="rounded-xl border border-red-200 p-4"><summary className="cursor-pointer font-semibold text-red-700">Request data deletion</summary>
          <p className="mt-2 text-sm text-ink-soft">Your request is forwarded to the admin, who processes it through a recorded procedure. Personal data and Counselor conversations will be permanently deleted and this cannot be undone.</p>
          <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">Type DELETE to confirm<input className="field font-normal" value={del} onChange={(e) => setDel(e.target.value)} /></label>
          <button className="btn-danger mt-3" disabled={del !== "DELETE"} onClick={remove}>Request deletion</button></details>
      </section>
      <button className="self-start text-sm font-semibold text-brand" onClick={() => router.push("/bantuan")}>Need help?</button>
    </div>
  );
}

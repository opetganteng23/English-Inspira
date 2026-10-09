"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";

type M = { on: boolean; message: string; since: string | null };

/** Saklar mode pemeliharaan di dasbor admin. Saat aktif hanya admin yang bisa memakai aplikasi. */
export function MaintenanceToggle() {
  const { data, reload } = useApi<M>("/api/admin/maintenance");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (data) setMessage(data.message); }, [data]);

  async function set(on: boolean) {
    if (on && !confirm("Turn on maintenance mode? Everyone except admins will only see the maintenance page.")) return;
    setBusy(true); setErr("");
    try { await api("/api/admin/maintenance", { method: "PUT", json: { on, message } }); reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  const on = !!data?.on;
  return (
    <section className={`card flex flex-col gap-3 ${on ? "border-2 border-accent" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-navy">Maintenance mode</h2>
          <p className="text-sm text-ink-soft">{on ? <>On{data?.since ? ` since ${new Date(data.since).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}. Only admins can use the site. Admins sign in at <b>/admin/login</b>.</> : "Off. The site is open to everyone."}</p>
        </div>
        <button role="switch" aria-checked={on} aria-label="Maintenance mode" disabled={busy || !data} onClick={() => set(!on)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-accent" : "bg-line-strong"}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
        </button>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Message shown to visitors (optional)
        <input className="field font-normal" maxLength={300} placeholder="e.g. We are upgrading the system and will be back at 10:00 WIB." value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {on && <button className="btn-outline self-start" disabled={busy} onClick={() => set(true)}>Update message</button>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </section>
  );
}

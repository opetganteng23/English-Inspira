"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function LeadForm({ source = "landing", cta = "Kabari saya", dark = false }: { source?: string; cta?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState("busy");
    try { await api("/api/leads", { json: { email, source } }); setState("ok"); setMsg("Terima kasih! Kami akan menghubungi lewat email."); setEmail(""); }
    catch (x) { setState("err"); setMsg((x as Error).message); }
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row" aria-label="Formulir email">
      <label className="sr-only" htmlFor={`lead-${source}`}>Email</label>
      <input id={`lead-${source}`} type="email" required placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`field ${dark ? "border-transparent" : ""}`} />
      <button className="btn-accent shrink-0" disabled={state === "busy"}>{state === "busy" ? "Mengirim…" : cta}</button>
      {state !== "idle" && state !== "busy" && <p role="status" className={`text-sm sm:basis-full ${state === "ok" ? "text-success" : "text-red-600"}`}>{msg}</p>}
    </form>
  );
}

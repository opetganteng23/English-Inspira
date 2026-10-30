"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/client";

type R = {
  participants: { id: string; name: string | null; email: string; status: string; institution: string | null }[];
  staff: { id: string; name: string | null; email: string; role: string; institution: string | null }[];
  institutions: { id: string; name: string; code: string }[];
  tests: { id: string; name: string; kind: string }[];
};
const ROLE: Record<string, string> = { admin: "Admin", academic_admin: "Academic admin", content_editor: "Question editor", inst_admin: "Institutions", coach: "Coach" };

/** Pencarian global admin (tekan "/" untuk fokus). Hasil punya aksi cepat: profil, jadwal & pindah sesi, laporan. */
export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [r, setR] = useState<R | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); input.current?.focus(); }
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, []);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setR(null); return; }
    let stop = false;
    setBusy(true);
    const t = setTimeout(async () => {
      try { const d = await api<R>(`/api/admin/search?q=${encodeURIComponent(s)}`, { silent: true }); if (!stop) { setR(d); setOpen(true); } }
      catch { if (!stop) setR(null); } finally { if (!stop) setBusy(false); }
    }, 250);
    return () => { stop = true; clearTimeout(t); };
  }, [q]);

  const empty = r && !r.participants.length && !r.staff.length && !r.institutions.length && !r.tests.length;
  const act = "rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-tint";
  return (
    <div ref={box} className="relative w-full max-w-md">
      <input ref={input} type="search" aria-label="Search participants, staff, institutions, tests" placeholder="Search name, email, institution, test…  ( / )"
        className="field !h-10 !text-sm" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => r && setOpen(true)} />
      {open && r && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white p-2 text-sm shadow-lg">
          {busy && <p className="px-2 py-1 text-xs text-ink-soft">Searching…</p>}
          {empty && <p className="px-2 py-2 text-ink-soft">Nothing found for “{q.trim()}”.</p>}
          {!!r.participants.length && <Group title="Participants">{r.participants.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-1 rounded-lg px-2 py-1.5 hover:bg-canvas">
              <span className="min-w-0"><b className="text-navy">{u.name ?? "(no name yet)"}</b><span className="block truncate text-xs text-ink-soft">{u.email}{u.institution ? ` · ${u.institution}` : ""}</span></span>
              <span className="flex gap-1"><Link className={act} href={`/admin/participants/${u.id}`}>Profile</Link><Link className={act} href={`/admin/participants/${u.id}#admin-actions`}>Schedule & actions</Link></span>
            </li>
          ))}</Group>}
          {!!r.staff.length && <Group title="Coaches & admins">{r.staff.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 hover:bg-canvas">
              <span className="min-w-0"><b className="text-navy">{u.name ?? u.email}</b><span className="block truncate text-xs text-ink-soft">{ROLE[u.role] ?? u.role}{u.institution ? ` · ${u.institution}` : ""} · {u.email}</span></span>
              <Link className={act} href={`/admin/users?q=${encodeURIComponent(u.email)}`}>Manage</Link>
            </li>
          ))}</Group>}
          {!!r.institutions.length && <Group title="Institutions">{r.institutions.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 hover:bg-canvas">
              <span><b className="text-navy">{i.name}</b><span className="ml-1 text-xs text-ink-soft">{i.code}</span></span>
              <span className="flex gap-1"><Link className={act} href={`/institution?institution=${i.id}`}>Portal</Link><Link className={act} href={`/admin/institutions/${i.id}`}>Manage</Link></span>
            </li>
          ))}</Group>}
          {!!r.tests.length && <Group title="Tests">{r.tests.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 hover:bg-canvas">
              <span><b className="text-navy">{t.name}</b><span className="ml-1 text-xs text-ink-soft">{t.kind}</span></span>
              <span className="flex gap-1"><Link className={act} href={`/admin/tests/${t.id}`}>Open</Link><Link className={act} href={`/admin/tests/${t.id}?tab=schedule`}>Schedule</Link></span>
            </li>
          ))}</Group>}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="py-1"><p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{title}</p><ul>{children}</ul></div>;
}

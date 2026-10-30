"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { InstScope } from "@/lib/inst-client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { askConfirm } from "@/components/Feedback";
import { ImportPanel } from "@/components/ImportPanel";
import { Editor, PersonnelImport, type I } from "@/components/InstitutionAdmin";
import { EditAccountDialog, ResetPasswordDialog } from "@/components/AccountDialogs";
import InstHome from "@/app/(inst)/institution/page";
import InstParticipants from "@/app/(inst)/institution/participants/page";
import InstSchedule from "@/app/(inst)/institution/schedule/page";
import InstAnalytics from "@/app/(inst)/institution/analytics/page";
import InstReports from "@/app/(inst)/institution/reports/page";

// Halaman satu institusi: semua urusan satu klien dalam tab. Tab portal dipasang dengan InstScope (konteks institusi ini).
const TABS = [
  ["overview", "Overview"], ["participants", "Participants"], ["people", "Admins & coaches"], ["personnel", "Personnel data"],
  ["schedule", "Tests & schedule"], ["classes", "Classes"], ["results", "Results & reports"], ["settings", "Settings"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function InstitutionPage({ params }: { params: { id: string } }) {
  const { data, error, reload } = useApi<{ institutions: I[] }>("/api/admin/institutions");
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some(([k]) => k === t)) setTab(t as Tab);
  }, []);
  const go = (t: Tab) => { setTab(t); window.history.replaceState(null, "", `?tab=${t}`); };
  const inst = data?.institutions.find((i) => i.id === params.id);
  if (!data) return <Loading text={error || undefined} />;
  if (!inst) return <ErrorNote text="Institution not found." />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-brand">INSTITUTION · {inst.code}</p>
          <h1 className="page-title">{inst.name}</h1>
          <p className="text-sm text-ink-soft">{inst.status === "active" ? "Active" : "Inactive"} · {inst.seatsUsed}/{inst.seats} seats{inst.contractEnd ? ` · contract until ${tgl(inst.contractEnd)}` : ""}{inst.holdPlacementResults ? ` · results on hold (${inst.heldResults ?? 0})` : ""}</p>
        </div>
        <Link href={`/institution?institution=${inst.id}`} className="btn-outline">Open institution portal</Link>
      </div>

      <div role="tablist" aria-label="Institution sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === k ? "border-brand text-navy" : "border-transparent text-ink-soft hover:text-navy"}`}>{label}</button>
        ))}
      </div>

      <InstScope id={inst.id}>
        {tab === "overview" && <InstHome />}
        {tab === "participants" && <ParticipantsTab id={inst.id} />}
        {tab === "people" && <PeopleTab inst={inst} />}
        {tab === "personnel" && <section className="card"><h2 className="mb-3 font-display text-lg font-extrabold text-navy">Personnel data (HR import)</h2><PersonnelImport id={inst.id} /></section>}
        {tab === "schedule" && <InstSchedule />}
        {tab === "classes" && <ClassesTab id={inst.id} />}
        {tab === "results" && <div className="flex flex-col gap-8"><InstAnalytics /><InstReports /></div>}
        {tab === "settings" && <SettingsTab inst={inst} onSaved={reload} />}
      </InstScope>
    </div>
  );
}

function ParticipantsTab({ id }: { id: string }) {
  const [add, setAdd] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><button className="btn-solid" onClick={() => setAdd(true)}>+ Add or import participants</button></div>
      <InstParticipants />
      {add && <Modal title="Add participants" onClose={() => { setAdd(false); window.location.reload(); }} wide><ImportPanel base={`/api/admin/institutions/${id}`} /></Modal>}
    </div>
  );
}

type U = { id: string; name: string | null; givenName?: string; surname?: string; phone?: string; email: string; role: string; status: string; institutionId: string | null };
const ROLE: Record<string, string> = { inst_admin: "Institutions", coach: "Coach" };

/** Admin institusi dan coach milik institusi ini: tambah, ubah, reset password, kirim ulang undangan. */
function PeopleTab({ inst }: { inst: I }) {
  const { data, loading, error, reload } = useApi<{ users: U[] }>("/api/admin/users");
  const [v, setV] = useState({ email: "", name: "", role: "inst_admin" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dlg, setDlg] = useState<{ type: "edit" | "reset"; u: U } | null>(null);
  const people = (data?.users ?? []).filter((u) => u.institutionId === inst.id && (u.role === "inst_admin" || u.role === "coach"));
  async function add() {
    setBusy(true); setErr(""); setMsg("");
    try { await api("/api/admin/users", { json: { email: v.email, name: v.name || undefined, role: v.role, institutionId: inst.id } }); setMsg(`Invitation sent to ${v.email}.`); setV({ email: "", name: "", role: v.role }); reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function resend(id: string) {
    try { await api(`/api/admin/users/${id}`, { json: { action: "resend_invitation" } }); setMsg("Invitation resent."); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Add an admin or coach for {inst.name}</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_180px_auto]">
          <input className="field" type="email" placeholder="Email" aria-label="Email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          <input className="field" placeholder="Name (optional)" aria-label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <select className="field" aria-label="Role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}><option value="inst_admin">Institutions (leader)</option><option value="coach">Coach</option></select>
          <button className="btn-solid" disabled={busy || !/\S+@\S+\.\S+/.test(v.email)} onClick={add}>{busy ? "Saving…" : "Add"}</button>
        </div>
        <p className="text-xs text-ink-soft">They receive an invitation email and sign in with a password or an email code. Set a password with Reset password if needed.</p>
        <ErrorNote text={err} />
        {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      </section>
      {loading && !data ? <Loading /> : error ? <ErrorNote text={error} /> : (
        <section className="card">
          {people.length ? <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>{people.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold text-navy">{u.name ?? "(no name yet)"}<br /><span className="text-xs font-normal text-ink-soft">{u.email}</span></td>
                <td>{ROLE[u.role] ?? u.role}</td>
                <td><span className={u.status === "active" ? "badge-ok" : u.status === "invited" ? "badge-warn" : "badge-bad"}>{u.status === "active" ? "Active" : u.status === "invited" ? "Awaiting activation" : "Inactive"}</span></td>
                <td className="whitespace-nowrap text-right">
                  <button className="mr-3 font-semibold text-brand" onClick={() => setDlg({ type: "edit", u })}>Edit</button>
                  <button className="mr-3 font-semibold text-brand" onClick={() => setDlg({ type: "reset", u })}>Reset password</button>
                  {u.status === "invited" && <button className="font-semibold text-brand" onClick={() => resend(u.id)}>Resend invite</button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div> : <p className="text-sm text-ink-soft">No admins or coaches for this institution yet. Add one above.</p>}
        </section>
      )}
      {dlg?.type === "edit" && <EditAccountDialog kind="internal" institutions={[{ id: inst.id, name: inst.name }]} account={{ ...dlg.u, name: dlg.u.name, role: dlg.u.role as never, institutionId: dlg.u.institutionId }} onClose={() => setDlg(null)} onDone={(m) => { setDlg(null); setMsg(m); reload(); }} />}
      {dlg?.type === "reset" && <ResetPasswordDialog kind="internal" account={dlg.u} onClose={() => setDlg(null)} />}
    </div>
  );
}

type Cls = { id: string; name: string; levelId: string; capacity: number; isActive: boolean; institutionId: string | null; coach: string | null; students: number; avgScore: number | null };

function ClassesTab({ id }: { id: string }) {
  const { data, loading, error } = useApi<{ levels: { id: string; name: string }[]; classes: Cls[] }>("/api/admin/classes");
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote text={error} />;
  const lv = new Map(data.levels.map((l) => [l.id, l.name]));
  const mine = data.classes.filter((c) => c.institutionId === id);
  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Classes</h2><Link href="/admin/classes" className="text-sm font-semibold text-brand">Manage classes →</Link></div>
      {mine.length ? <div className="table-wrap mt-3"><table>
        <thead><tr><th>Class</th><th>Level</th><th>Students</th><th>Average score</th><th>Coach</th></tr></thead>
        <tbody>{mine.map((c) => <tr key={c.id}><td className="font-semibold text-navy">{c.name}{!c.isActive && <span className="badge-muted ml-2">inactive</span>}</td><td>{lv.get(c.levelId) ?? "-"}</td><td>{c.students}/{c.capacity}</td><td>{c.avgScore ?? "-"}</td><td>{c.coach ?? "-"}</td></tr>)}</tbody>
      </table></div> : <p className="mt-2 text-sm text-ink-soft">No classes yet. Classes are created automatically from placement results.</p>}
    </section>
  );
}

function SettingsTab({ inst, onSaved }: { inst: I; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 border-b border-line py-2 text-sm"><span className="text-ink-soft">{k}</span><span className="text-right font-semibold text-navy">{v}</span></div>;
  async function release() {
    if (!(await askConfirm(`Release all held placement results for ${inst.name}? ${inst.heldResults ?? 0} participant(s) will see their score, level, and report, and result emails are sent. This cannot be undone.`, { confirmLabel: "Release results", danger: true }))) return;
    await api(`/api/admin/institutions/${inst.id}`, { method: "PATCH", json: { ...inst, holdPlacementResults: false } });
    onSaved();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card">
        <div className="flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Institution</h2><button className="btn-outline !min-h-[36px]" onClick={() => setEdit(true)}>Edit</button></div>
        <div className="mt-2">
          {row("Name", inst.name)}{row("Registration code", inst.code)}{row("Seats", `${inst.seatsUsed}/${inst.seats}`)}{row("Batch", inst.batch || "-")}{row("Modules", ["Tests & results", inst.modules?.learning && "Learning", inst.modules?.coaching && "Coaching"].filter(Boolean).join(", "))}
          {row("Contact email", inst.contactEmail || "-")}{row("Contract", `${inst.contractStart ? tgl(inst.contractStart) : "-"} to ${inst.contractEnd ? tgl(inst.contractEnd) : "-"}`)}{row("Status", inst.status === "active" ? "Active" : "Inactive")}
        </div>
      </section>
      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Placement results</h2>
        {inst.holdPlacementResults ? (
          <>
            <p className="text-sm">Results are <b>on hold</b> for {inst.holdFromInstAdmin === false ? "participants and coaches (institution admins can see them)" : "participants, coaches, and institution admins"}. Held now: <b>{inst.heldResults ?? 0}</b>.</p>
            <p className="text-xs text-ink-soft">Change who the hold applies to with Edit.</p>
            <button className="btn-danger self-start" onClick={release}>Release all held results…</button>
          </>
        ) : <p className="text-sm">Results are released automatically when a participant finishes. Turn on the hold with Edit.</p>}
      </section>
      {edit && <Editor init={inst} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); onSaved(); }} />}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type U = { id: string; name: string | null; email: string; role: "admin" | "inst_admin" | "coach"; status: "active" | "invited" | "disabled"; institution: string | null; institutionId: string | null; createdAt: string };
const ROLE = { admin: "Admin", inst_admin: "Institution admin", coach: "Coach" } as const;
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Pengguna() {
  const { data, loading, error, reload } = useApi<{ users: U[] }>("/api/admin/users");
  const insts = useApi<{ institutions: { id: string; name: string }[] }>("/api/admin/institutions");
  const [add, setAdd] = useState(false);
  const [err, setErr] = useState("");
  async function patch(id: string, body: object) { setErr(""); try { await api(`/api/admin/users/${id}`, { method: "PATCH", json: body }); reload(); } catch (e) { setErr((e as Error).message); } }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Coaches & Admins</h1><p className="text-sm text-ink-soft">Internal accounts. Coaches and institution admins are invited by email; everyone signs in with an OTP. Participants are managed in the Participants menu.</p></div><button className="btn-solid" onClick={() => setAdd(true)}>+ Add user</button></div>
      <ErrorNote text={error || err} />
      <div className="rounded-xl bg-canvas p-4 text-sm text-ink-soft"><b className="text-navy">Admin:</b> all admin modules. <b className="text-navy">Institution admin:</b> only participant data in their institution, filtered at the query level. <b className="text-navy">Coach:</b> sees participants in their institution and runs coaching sessions.</div>
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Institution</th><th>Status</th><th>Since</th><th /></tr></thead>
          <tbody>{data?.users.map((u) => (
            <tr key={u.id}><td className="font-semibold text-navy">{u.name ?? "(no name yet)"}<br /><span className="text-xs font-normal text-ink-soft">{u.email}</span></td><td>{ROLE[u.role]}</td><td>{u.institution ?? "-"}</td><td><span className={u.status === "active" ? "badge-ok" : u.status === "invited" ? "badge-warn" : "badge-bad"}>{u.status === "active" ? "Active" : u.status === "invited" ? "Awaiting activation" : "Inactive"}</span></td><td>{tgl(u.createdAt)}</td>
              <td className="whitespace-nowrap text-right"><button className="mr-3 font-semibold text-brand" onClick={() => patch(u.id, { status: u.status === "disabled" ? "active" : "disabled" })}>{u.status === "disabled" ? "Activate" : "Deactivate"}</button></td></tr>
          ))}</tbody>
        </table></div>
      )}
      {add && <AddModal institutions={insts.data?.institutions ?? []} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); reload(); }} />}
    </div>
  );
}

function AddModal({ institutions, onClose, onSaved }: { institutions: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ email: "", name: "", role: "admin", institutionId: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    try { await api("/api/admin/users", { json: { email: v.email, name: v.name || undefined, role: v.role, institutionId: v.role !== "admin" ? v.institutionId || null : null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Add internal user" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Email<input className="field font-normal" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <label className={label}>Name (optional)<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <label className={label}>Role<select className="field font-normal" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}><option value="admin">Admin</option><option value="inst_admin">Institution admin</option><option value="coach">Coach</option></select></label>
        {v.role !== "admin" && <label className={label}>Institution<select className="field font-normal" value={v.institutionId} onChange={(e) => setV({ ...v, institutionId: e.target.value })}><option value="">Choose an institution</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
        <p className="text-xs text-ink-soft">Users sign in on the Sign in page with this email (OTP code). There is no password.</p>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !v.email || (v.role !== "admin" && !v.institutionId)} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </Modal>
  );
}

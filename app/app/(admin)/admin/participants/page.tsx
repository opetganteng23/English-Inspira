"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { askConfirm } from "@/components/Feedback";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { EditAccountDialog, ResetPasswordDialog, DeleteAccountDialog } from "@/components/AccountDialogs";

type Row = { id: string; name: string | null; email: string; status: string; institution: string | null; level: string | null; scoreEst: number | null; placementDone: boolean; qaTester?: boolean; quota: { used: number; total: number } | null; tests: number; lastAt: string | null; lastLoginAt: string | null };
type Detail = {
  profile: { id: string; name?: string; givenName?: string; surname?: string; email: string; phone?: string; status: string; institution: string | null; consentAt: string | null; lastLoginAt: string | null; createdAt: string; level: string | null; scoreEst: number | null; placementDone: boolean; placementRetakeAllowed: boolean; qaTester?: boolean };
  enrollment: { status: string; startsAt: string; expiresAt: string | null } | null;
  quotas: { level: string; used: number; total: number; active: boolean }[];
  attempts: { id: string; kind: string; scoreEst: number; finishedAt: string; flags: number; held?: boolean }[];
  notes: { text: string; at: string }[];
};
const STATUS: Record<string, [string, string]> = { invited: ["Awaiting activation", "badge-warn"], active: ["Active", "badge-ok"], disabled: ["Inactive", "badge-muted"] };

export default function Peserta() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const qs = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("status");
  const [init] = useState(qs ?? "");
  const eff = status || init;
  const { data, loading, error, reload } = useApi<{ participants: Row[]; total: number; pages: number }>(`/api/admin/participants?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}${eff ? `&status=${eff}` : ""}`);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Participants</h1><p className="text-sm text-ink-soft">All participants across institutions · {data?.total ?? 0} participants. Participants are added from the Institutions menu.</p></div>
      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="field w-auto" aria-label="Status" value={eff} onChange={(e) => { setPage(1); setStatus(e.target.value); }}><option value="">All statuses</option><option value="invited">Awaiting activation</option><option value="active">Active</option><option value="disabled">Inactive</option></select>
      </div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Participant</th><th>Status</th><th>Level</th><th>Score</th><th>Coaching quota</th><th>Tests</th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold text-navy">{p.name ?? "(no name yet)"}{p.qaTester && <span className="ml-2 rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent-dark">QA</span>}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.institution ? ` · ${p.institution}` : ""}</span></td>
                <td><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span></td>
                <td>{p.level ?? (p.placementDone ? "-" : "No placement yet")}</td><td>{p.scoreEst ?? "-"}</td><td>{p.quota ? `${p.quota.used}/${p.quota.total}` : "-"}</td><td>{p.tests}</td>
                <td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(p.id)}>Detail</button></td>
              </tr>
            ))}
            {data?.participants.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">No participants.</td></tr>}
          </tbody>
        </table></div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-soft"><span>Page {page} of {data?.pages ?? 1}</span><div className="flex gap-2"><button className="btn-outline !min-h-[40px]" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn-outline !min-h-[40px]" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(page + 1)}>Next</button></div></div>
      {sel && <DetailModal id={sel} onClose={() => { setSel(null); reload(); }} />}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: d, error, reload } = useApi<Detail>(`/api/admin/participants/${id}`);
  const [note, setNote] = useState("");
  const [ext, setExt] = useState({ days: 30, reason: "" });
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dlg, setDlg] = useState<"edit" | "reset" | "delete" | null>(null);
  const run = async (body: Record<string, unknown>, ok?: string) => {
    setErr(""); setMsg("");
    try { await api(`/api/admin/participants/${id}`, { json: body }); if (ok) setMsg(ok); reload(); } catch (e) { setErr((e as Error).message); }
  };
  const p = d?.profile;

  return (
    <Modal title="Participant details" onClose={onClose} wide>
      {!d || !p ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-5 text-sm">
          <div><p className="font-display text-xl font-extrabold text-navy">{p.name ?? "(no name yet)"}</p><p className="text-ink-soft">{p.email}{p.phone ? ` · ${p.phone}` : ""}{p.institution ? ` · ${p.institution}` : ""} · created {tgl(p.createdAt)}{p.lastLoginAt ? ` · last sign-in ${tgl(p.lastLoginAt)}` : ""}</p>
            <p className="mt-1"><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span> {p.level && <span className="badge-ok ml-1">{p.level}{p.scoreEst ? ` · ${p.scoreEst}` : ""}</span>} {p.consentAt && <span className="ml-1 text-xs text-ink-soft">data consent {tgl(p.consentAt)}</span>}</p>
            {p.status === "invited" && <p className="mt-1 text-xs text-ink-soft">The participant activates the account by signing in and accepting the data consent. You can also activate it below with a reason (for example, consent collected on a paper form).</p>}</div>
          <ErrorNote text={err} />
          {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-success">{msg}</p>}

          <section><h3 className="font-semibold text-navy">Access & quota</h3>
            <p className="text-ink-soft">{d.enrollment ? `Enrollment ${d.enrollment.status} · ${d.enrollment.expiresAt ? `ends ${tgl(d.enrollment.expiresAt)}` : "no limit"}` : "No enrollment yet."}</p>
            {d.quotas.length > 0 && <ul className="mt-1">{d.quotas.map((q, i) => <li key={i}>Coaching {q.level}: {q.used}/{q.total}{q.active ? "" : " (inactive)"}</li>)}</ul>}
            <div className="mt-2 grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[100px_1fr_auto]"><input aria-label="Days" className="field" type="number" min={1} max={730} value={ext.days} onChange={(e) => setExt({ ...ext, days: Number(e.target.value) })} /><input aria-label="Extension reason" className="field" placeholder="Reason for extending access (required)" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} /><button className="btn-outline" disabled={ext.reason.trim().length < 3} onClick={() => run({ action: "extend_enrollment", ...ext }, "Access extended.").then(() => setExt({ days: 30, reason: "" }))}>Extend</button></div></section>

          <section><h3 className="font-semibold text-navy">Test history</h3>
            {d.attempts.length ? <ul className="mt-1">{d.attempts.map((a) => <li key={a.id} className="flex justify-between gap-3 border-b border-line py-1.5"><span>{a.kind} · {tgl(a.finishedAt)}{a.flags ? ` · ${a.flags} activity notes` : ""}{a.held ? " · held (not visible to participant)" : ""}</span><b>{a.scoreEst}</b></li>)}</ul> : <p className="text-ink-soft">None yet.</p>}
            {d.attempts.some((a) => a.held) && <button className="btn-outline mt-2 !min-h-[40px]" onClick={async () => { if (await askConfirm("Release this participant's held placement result now? They, their institution admin, and coaches will see it, and the result email is sent.", { confirmLabel: "Release result" })) run({ action: "release_results" }, "Result released."); }}>Release this result</button>}</section>

          <section><h3 className="font-semibold text-navy">Actions</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-outline !min-h-[40px]" onClick={() => setDlg("edit")}>Edit profile</button>
              <button className="btn-outline !min-h-[40px]" onClick={() => setDlg("reset")}>Reset password</button>
              <button className="btn-danger !min-h-[40px]" onClick={() => setDlg("delete")}>Delete account</button>
              {p.status === "invited" && <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "resend_invitation" }, "Invitation resent.")}>Resend invitation</button>}
              <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: p.qaTester ? "qa_off" : "qa_on" }, p.qaTester ? "QA tester access removed." : "QA tester access granted. This account can now see and run tests in Test mode.")}>{p.qaTester ? "Remove QA tester" : "Make QA tester"}</button>
              {p.status === "disabled" ? <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "enable" }, "Account activated.")}>Activate</button> : <button className="btn-outline !min-h-[40px]" onClick={() => run({ action: "disable" }, "Account deactivated.")}>Deactivate</button>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input aria-label="Reason" className="field" placeholder="Reason (required for the actions on the right)" value={reason} onChange={(e) => setReason(e.target.value)} />
              {p.status === "invited" && <button className="btn-outline" disabled={reason.trim().length < 3} onClick={() => run({ action: "activate", reason }, "Account activated. The reason is kept in the audit log as the basis of the data consent.")}>Activate now</button>}
              <button className="btn-outline" disabled={!p.placementDone || p.placementRetakeAllowed || reason.trim().length < 3} onClick={() => run({ action: "allow_placement_retake", reason }, "Placement may be retaken once.")}>Allow placement retake</button>
            </div>
          </section>

          <section><h3 className="font-semibold text-navy">Admin notes</h3>
            <ul className="mt-1">{d.notes.map((n, i) => <li key={i} className="border-b border-line py-1.5">{n.text}<span className="ml-2 text-xs text-ink-soft">{tgl(n.at, true)}</span></li>)}</ul>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input aria-label="Note" className="field" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-outline shrink-0" disabled={!note.trim()} onClick={() => run({ action: "note", text: note }).then(() => setNote(""))}>Save note</button></div></section>
        </div>
      )}
      {d && p && dlg === "edit" && <EditAccountDialog kind="participant" account={{ id, name: p.name ?? null, givenName: p.givenName, surname: p.surname, email: p.email, phone: p.phone }} onClose={() => setDlg(null)} onDone={(m) => { setDlg(null); setMsg(m); reload(); }} />}
      {d && p && dlg === "reset" && <ResetPasswordDialog kind="participant" account={{ id, name: p.name ?? null, email: p.email }} onClose={() => setDlg(null)} />}
      {d && p && dlg === "delete" && <DeleteAccountDialog kind="participant" account={{ id, name: p.name ?? null, email: p.email }} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onClose(); }} />}
    </Modal>
  );
}

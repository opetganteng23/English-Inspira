"use client";

import { StuckActions } from "@/components/MonitoringBoard";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { askConfirm } from "@/components/Feedback";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { EditAccountDialog, ResetPasswordDialog, DeleteAccountDialog } from "@/components/AccountDialogs";

type Detail = {
  profile: { id: string; name?: string; givenName?: string; surname?: string; email: string; phone?: string; status: string; institution: string | null; consentAt: string | null; lastLoginAt: string | null; createdAt: string; level: string | null; scoreEst: number | null; placementDone: boolean; placementRetakeAllowed: boolean; qaTester?: boolean };
  enrollment: { status: string; startsAt: string; expiresAt: string | null } | null;
  quotas: { level: string; used: number; total: number; active: boolean }[];
  attempts: { id: string; kind: string; scoreEst: number; finishedAt: string; running?: boolean; startedAt?: string; flags: number; held?: boolean; voidable?: boolean }[];
  notes: { text: string; at: string }[];
  schedule?: { testId: string; test: string; sessionId: string; started: boolean; sessions: { id: string; label: string; opensAt: string; closesAt: string; left: number }[] }[];
  voided?: { id: string; test: string; score: number | null; status: string; finishedAt: string | null; voidedAt: string; reason: string }[];
};
export const STATUS: Record<string, [string, string]> = { invited: ["Awaiting activation", "badge-warn"], active: ["Active", "badge-ok"], disabled: ["Inactive", "badge-muted"] };

/** Panel aksi admin untuk satu peserta: jadwal tes & pindah sesi, akses, riwayat tes (void/restore/terminate), akun, catatan.
 * Dipakai di popup daftar Participants dan di halaman detail peserta. */
export function ParticipantAdminPanel({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
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
  const [voidFor, setVoidFor] = useState<{ id: string; label: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");

  return (
    <>
      {!d || !p ? <Loading text={error || "Loading…"} /> : (
        <div className="flex flex-col gap-5 text-sm">
          <div><p className="font-display text-xl font-extrabold text-navy">{p.name ?? "(no name yet)"}</p><p className="text-ink-soft">{p.email}{p.phone ? ` · ${p.phone}` : ""}{p.institution ? ` · ${p.institution}` : ""} · created {tgl(p.createdAt)}{p.lastLoginAt ? ` · last sign-in ${tgl(p.lastLoginAt)}` : ""}</p>
            <p className="mt-1"><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span> {p.level && <span className="badge-ok ml-1">{p.level}{p.scoreEst ? ` · ${p.scoreEst}` : ""}</span>} {p.consentAt && <span className="ml-1 text-xs text-ink-soft">data consent {tgl(p.consentAt)}</span>}</p>
            {p.status === "invited" && <p className="mt-1 text-xs text-ink-soft">The participant activates the account by signing in and accepting the data consent. You can also activate it below with a reason (for example, consent collected on a paper form).</p>}</div>
          <ErrorNote text={err} />
          {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-success">{msg}</p>}

          {!!d.schedule?.length && <ScheduleSection userId={id} rows={d.schedule} onDone={(m) => { setMsg(m); reload(); }} />}

          <section><h3 className="font-semibold text-navy">Access & quota</h3>
            <p className="text-ink-soft">{d.enrollment ? `Enrollment ${d.enrollment.status} · ${d.enrollment.expiresAt ? `ends ${tgl(d.enrollment.expiresAt)}` : "no limit"}` : "No enrollment yet."}</p>
            {d.quotas.length > 0 && <ul className="mt-1">{d.quotas.map((q, i) => <li key={i}>Coaching {q.level}: {q.used}/{q.total}{q.active ? "" : " (inactive)"}</li>)}</ul>}
            <div className="mt-2 grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[100px_1fr_auto]"><input aria-label="Days" className="field" type="number" min={1} max={730} value={ext.days} onChange={(e) => setExt({ ...ext, days: Number(e.target.value) })} /><input aria-label="Extension reason" className="field" placeholder="Reason for extending access (required)" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} /><button className="btn-outline" disabled={ext.reason.trim().length < 3} onClick={() => run({ action: "extend_enrollment", ...ext }, "Access extended.").then(() => setExt({ days: 30, reason: "" }))}>Extend</button></div></section>

          <section><h3 className="font-semibold text-navy">Test history</h3>
            {d.attempts.length ? <ul className="mt-1">{d.attempts.map((a) => a.running ? <li key={a.id} className="border-b border-line py-1.5"><span>{a.kind} · <b className="text-accent">running</b> since {tgl(a.startedAt ?? "", true)}</span><StuckActions id={a.id} name={d.profile.name ?? d.profile.email} onDone={() => location.reload()} /></li> : <li key={a.id} className="flex justify-between gap-3 border-b border-line py-1.5"><span>{a.kind} · {tgl(a.finishedAt)}{a.flags ? ` · ${a.flags} activity notes` : ""}{a.held ? " · held (not visible to participant)" : ""}</span><span className="flex items-center gap-3"><b>{a.scoreEst}</b>{a.voidable && <button className="text-xs font-semibold text-red-700" onClick={() => setVoidFor({ id: a.id, label: `${a.kind} · ${tgl(a.finishedAt)} · score ${a.scoreEst ?? "-"}` })}>Void</button>}</span></li>)}</ul> : <p className="text-ink-soft">None yet.</p>}
            {!!d.voided?.length && (
              <div className="mt-3 rounded-lg border border-line p-3">
                <p className="font-semibold text-navy">Voided attempts</p>
                <p className="text-xs text-ink-soft">Restore puts the original attempt back (answers, score, release status). Not possible while the participant has a newer attempt on the same test.</p>
                <ul className="mt-2 flex flex-col divide-y divide-line">{d.voided.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><b className="text-navy">{v.test}</b> · score {v.score ?? "-"}{v.finishedAt ? ` · ${tgl(v.finishedAt)}` : ""}<span className="block text-xs text-ink-soft">Voided {tgl(v.voidedAt, true)}: {v.reason}</span></span>
                    <button className="btn-outline !min-h-[36px] text-sm" onClick={async () => { const reason = window.prompt("Reason for restoring (kept in the audit log):", "Participant does not need to retake"); if (!reason || reason.trim().length < 5) return; if (await askConfirm(`Restore this attempt (score ${v.score ?? "-"})?`, { confirmLabel: "Restore" })) run({ action: "restore_attempt", voidId: v.id, reason }, "Attempt restored."); }}>Restore</button>
                  </li>
                ))}</ul>
              </div>
            )}
            {voidFor && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="font-semibold text-red-800">Void this attempt: {voidFor.label}</p>
                <p className="text-xs text-red-800">Use this only when the attempt was broken by a technical problem. It is removed from results and reports (kept in an archive with your reason), any class formed from it is released, and the participant can be scheduled and take the test again. Then move them to a session on the Schedule board and send the invite.</p>
                <input className="field" placeholder="Reason, e.g. Reading closed automatically by a system error" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                <div className="flex gap-2"><button className="btn-outline !min-h-[40px]" onClick={() => { setVoidFor(null); setVoidReason(""); }}>Cancel</button>
                  <button className="btn-solid !min-h-[40px] !bg-red-700" disabled={voidReason.trim().length < 5} onClick={async () => { if (await askConfirm("Void this attempt? The participant will need to take the test again.", { danger: true, confirmLabel: "Void attempt" })) { await run({ action: "void_attempt", attemptId: voidFor.id, reason: voidReason }, "Attempt voided. Move the participant to a session on the Schedule board, then send the invite."); setVoidFor(null); setVoidReason(""); } }}>Void attempt</button></div>
              </div>
            )}
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
      {d && p && dlg === "delete" && <DeleteAccountDialog kind="participant" account={{ id, name: p.name ?? null, email: p.email }} onClose={() => setDlg(null)} onDone={() => { setDlg(null); if (onDeleted) onDeleted(); else window.location.href = "/admin/participants"; }} />}
    </>
  );
}

export function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  return <Modal title="Participant details" onClose={onClose} wide><ParticipantAdminPanel id={id} onDeleted={onClose} /></Modal>;
}

/** Jadwal tes peserta dan pindah sesi langsung dari profil (memakai API pindah kursi yang sama dengan papan jadwal). */
function ScheduleSection({ userId, rows, onDone }: { userId: string; rows: NonNullable<Detail["schedule"]>; onDone: (msg: string) => void }) {
  const [to, setTo] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const when = (x: { opensAt: string; closesAt: string }) => `${tgl(x.opensAt, true)} – ${new Date(x.closesAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`;
  async function move(r: NonNullable<Detail["schedule"]>[number]) {
    const target = r.sessions.find((x) => x.id === to[r.testId]);
    if (!target) return;
    if (!(await askConfirm(`Move this participant to ${target.label} (${when(target)})?`, { confirmLabel: "Move" }))) return;
    setBusy(r.testId); setErr("");
    try { await api(`/api/admin/tests/${r.testId}/schedule/move`, { json: { userIds: [userId], sessionId: target.id, reason: reason.trim() || undefined } }); setTo({ ...to, [r.testId]: "" }); onDone(`Moved to ${target.label}. Send the new schedule email from the test's schedule page if needed.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  return (
    <section><h3 className="font-semibold text-navy">Test schedule</h3>
      <ErrorNote text={err} />
      <ul className="mt-1 flex flex-col divide-y divide-line">{rows.map((r) => {
        const cur = r.sessions.find((x) => x.id === r.sessionId);
        return (
          <li key={r.testId} className="flex flex-col gap-2 py-2">
            <p><b className="text-navy">{r.test}</b> · {cur ? `${cur.label} (${when(cur)})` : "no session"}{r.started && <span className="ml-1 text-xs text-ink-soft">· already started, cannot be moved</span>}</p>
            {!r.started && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <select aria-label="New session" className="field sm:flex-1" value={to[r.testId] ?? ""} onChange={(e) => setTo({ ...to, [r.testId]: e.target.value })}>
                  <option value="">Move to another session…</option>
                  {r.sessions.filter((x) => x.id !== r.sessionId).map((x) => <option key={x.id} value={x.id} disabled={x.left < 1}>{x.label} · {when(x)} · {x.left} seats left</option>)}
                </select>
                <button className="btn-outline shrink-0" disabled={!to[r.testId] || busy === r.testId} onClick={() => move(r)}>{busy === r.testId ? "Moving…" : "Move"}</button>
              </div>
            )}
          </li>
        );
      })}</ul>
      {rows.some((r) => !r.started) && <input aria-label="Reason for the schedule change" className="field mt-1" placeholder="Reason for the schedule change (optional, shown in the schedule change report)" value={reason} onChange={(e) => setReason(e.target.value)} />}
    </section>
  );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ErrorNote } from "@/components/Charts";
import { api } from "@/lib/client";

export type Account = { id: string; name: string | null; givenName?: string; surname?: string; email: string; phone?: string | null; role?: string };
type Kind = "internal" | "participant";
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const base = (kind: Kind, id: string) => (kind === "internal" ? `/api/admin/users/${id}` : `/api/admin/participants/${id}`);

/** Ubah nama, email, dan telepon. Email baru harus unik; pengguna perlu masuk dengan kode OTP ke email itu. */
export function EditAccountDialog({ kind, account, onClose, onDone }: { kind: Kind; account: Account; onClose: () => void; onDone: (m: string) => void }) {
  const [v, setV] = useState({ givenName: account.givenName ?? "", surname: account.surname ?? "", email: account.email, phone: account.phone ?? "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    const body = { givenName: v.givenName, surname: v.surname, email: v.email, phone: v.phone };
    try {
      if (kind === "internal") await api(base(kind, account.id), { method: "PATCH", json: body });
      else await api(base(kind, account.id), { json: { action: "update_profile", ...body } });
      onDone(`Saved ${v.givenName} ${v.surname}.`.replace(/\s+\./, "."));
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Edit account" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Given name<input className="field font-normal" autoComplete="off" maxLength={60} value={v.givenName} onChange={(e) => setV({ ...v, givenName: e.target.value })} /></label>
          <label className={label}>Surname<input className="field font-normal" autoComplete="off" maxLength={60} value={v.surname} onChange={(e) => setV({ ...v, surname: e.target.value })} /></label>
        </div>
        <label className={label}>Email<input className="field font-normal" type="email" autoComplete="off" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          {v.email.trim().toLowerCase() !== account.email && <span className="text-xs font-normal text-accent-dark">Changing the email means the person must sign in with a code sent to the new address.</span>}</label>
        <label className={label}>Phone (optional)<input className="field font-normal" inputMode="tel" autoComplete="off" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !v.givenName.trim() || !v.email.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </Modal>
  );
}

/** Reset password: kirim tautan ke email (disarankan) atau buat password sementara yang tampil sekali. */
export function ResetPasswordDialog({ kind, account, onClose }: { kind: Kind; account: Account; onClose: () => void }) {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ type: "link" } | { type: "temp"; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  async function run(action: "reset_link" | "temp_password") {
    setBusy(true); setErr("");
    try {
      const d = await api(base(kind, account.id), { json: { action } });
      setResult(action === "reset_link" ? { type: "link" } : { type: "temp", password: d.password });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal title="Reset password" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">For <b className="text-navy">{account.name ?? account.email}</b> ({account.email}).</p>
        <ErrorNote text={err} />
        {!result && (
          <>
            <button className="card !p-4 text-left hover:border-brand" disabled={busy} onClick={() => run("reset_link")}>
              <b className="text-navy">Send a reset link by email (recommended)</b>
              <span className="mt-1 block text-sm text-ink-soft">They set their own new password. The link works once and expires in 30 minutes.</span>
            </button>
            <button className="card !p-4 text-left hover:border-brand" disabled={busy} onClick={() => run("temp_password")}>
              <b className="text-navy">Generate a temporary password</b>
              <span className="mt-1 block text-sm text-ink-soft">Use this if email does not arrive. It is shown once. The old password stops working immediately. Share it privately.</span>
            </button>
          </>
        )}
        {result?.type === "link" && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">Reset link queued for {account.email}. It arrives within a minute.</p>}
        {result?.type === "temp" && (
          <div role="status" className="rounded-xl border border-accent bg-accent-tint p-4">
            <p className="text-sm font-semibold text-accent-dark">Temporary password (shown only once)</p>
            <p className="mt-2 select-all break-all rounded-lg bg-white px-3 py-2 font-mono text-lg font-bold tracking-wide text-navy">{result.password}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-outline" onClick={async () => { try { await navigator.clipboard.writeText(result.password); setCopied(true); } catch { /* clipboard tidak tersedia */ } }}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="mt-3 text-xs text-accent-dark">Ask them to change it right after signing in (Profile, then Password), or to use “Forgot password”.</p>
          </div>
        )}
        <div className="flex justify-end"><button className="btn-outline" onClick={onClose}>{result ? "Done" : "Cancel"}</button></div>
      </div>
    </Modal>
  );
}

/** Hapus akun. Data pribadi dihapus atau dianonimkan; riwayat belajar dan audit tetap. Wajib beralasan. */
export function DeleteAccountDialog({ kind, account, onClose, onDone }: { kind: Kind; account: Account; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true); setErr("");
    try {
      if (kind === "internal") await api(base(kind, account.id), { method: "DELETE", json: { reason } });
      else await api(base(kind, account.id), { json: { action: "erase", reason } });
      onDone(`Deleted ${account.name ?? account.email}.`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Delete account" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">This deletes <b>{account.name ?? account.email}</b> ({account.email}). Personal data is removed and the person can no longer sign in. Test history without identity and audit logs are kept. This cannot be undone.</p>
        <label className={label}>Reason (kept in the audit log)<input className="field font-normal" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. left the program, duplicate account" /></label>
        <label className={label}>Type DELETE to confirm<input className="field font-normal" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-danger" disabled={busy || reason.trim().length < 3 || confirmText !== "DELETE"} onClick={del}>{busy ? "Deleting…" : "Delete account"}</button></div>
      </div>
    </Modal>
  );
}

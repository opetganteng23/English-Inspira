"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { uploadImage } from "@/lib/compress-image";
import { Loading, ErrorNote } from "@/components/Charts";

type Session = { id: string; title: string; date: string; place: string; organizer: string; quota: number; left: number; tooSoon: boolean };
type Reg = { id: string; status: string; docStatus: string; docNote: string | null; fullName: string; nikLast4: string; session: { title: string; date: string; place: string } | null; score: { listening: number; structure: number; reading: number; total: number } | null; certificateId: string | null; canCancel: boolean };
type Data = { itpRemaining: number; organizer: string; rescheduleDays: number; advice: { weeks: number; minDate: string; basis: string } | null; sessions: Session[]; registrations: Reg[] };

const STATUS: Record<string, [string, string]> = { submitted: ["Menunggu verifikasi", "badge-warn"], confirmed: ["Terkonfirmasi", "badge-ok"], done: ["Selesai", "badge-ok"], cancelled: ["Dibatalkan", "badge-muted"] };
const DOC: Record<string, [string, string]> = { pending: ["Dokumen diperiksa", "badge-warn"], valid: ["Dokumen valid", "badge-ok"], rejected: ["Dokumen ditolak", "badge-bad"] };

export default function Itp() {
  const { data, loading, error, reload } = useApi<Data>("/api/itp/sessions");
  const me = useApi<{ name: string | null }>("/api/me");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sel, setSel] = useState<Session | null>(null);
  const [f, setF] = useState({ fullName: "", nik: "", birthDate: "", gender: "", idPhoto: "", facePhoto: "", agree: false });
  const [up, setUp] = useState<"" | "id" | "face">("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function upload(kind: "idPhoto" | "facePhoto", file?: File) {
    if (!file) return;
    setErr(""); setUp(kind === "idPhoto" ? "id" : "face");
    try { const a = await uploadImage(file, { sensitive: true }); setF((x) => ({ ...x, [kind]: a.id })); }
    catch (e) { setErr((e as Error).message); } finally { setUp(""); }
  }
  async function submit() {
    setBusy(true); setErr("");
    try {
      await api("/api/itp/registrations", { json: { sessionId: sel!.id, fullName: f.fullName, nik: f.nik, birthDate: f.birthDate, gender: f.gender, idPhotoAssetId: f.idPhoto, facePhotoAssetId: f.facePhoto, agree: f.agree } });
      setDone(true); setStep(1); setSel(null); reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function cancel(id: string) {
    if (!confirm("Batalkan jadwal ini? Jatah pendaftaranmu dikembalikan sehingga kamu bisa memilih jadwal lain.")) return;
    try { await api(`/api/itp/registrations/${id}/cancel`, { json: {} }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  if (loading) return <Loading />;
  if (!data) return <ErrorNote text={error} />;
  const active = data.registrations.filter((r) => r.status !== "cancelled");
  const canRegister = data.itpRemaining > 0;
  const step2ok = f.fullName.trim().length >= 2 && /^(\d{16}|[A-Za-z0-9]{5,20})$/.test(f.nik.trim()) && f.birthDate && f.gender && f.idPhoto && f.facePhoto;
  const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="page-title">Tes TOEFL ITP Resmi</h1>
        <p className="mt-1 text-ink-soft">Tes diselenggarakan oleh {data.organizer || "mitra penyelenggara resmi"}. Di sini kamu hanya mendaftar dan memantau statusnya.</p>
      </div>
      <ErrorNote text={err || error} />
      {done && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">Pendaftaran terkirim. Admin akan memverifikasi dokumenmu; konfirmasi dikirim ke emailmu.</p>}

      {active.map((r) => (
        <section key={r.id} className="card flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2"><span className={STATUS[r.status][1]}>{STATUS[r.status][0]}</span>{r.status !== "done" && <span className={DOC[r.docStatus][1]}>{DOC[r.docStatus][0]}</span>}</div>
          <h2 className="font-display text-lg font-extrabold text-navy">{r.session?.title}</h2>
          <p className="text-sm text-ink-soft">{r.session && `${tgl(r.session.date, true)} · ${r.session.place}`}<br />Atas nama {r.fullName} · NIK •••• {r.nikLast4}</p>
          {r.docStatus === "rejected" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Dokumen ditolak: {r.docNote}. Hubungi admin untuk memperbaiki.</p>}
          {r.score && <div className="grid grid-cols-4 gap-2 text-center text-sm">{[["Listening", r.score.listening], ["Structure", r.score.structure], ["Reading", r.score.reading], ["Total", r.score.total]].map(([k, v]) => <div key={k} className="rounded-xl bg-canvas p-2"><p className="text-xs text-ink-soft">{k}</p><p className="font-display text-xl font-extrabold text-navy">{v}</p></div>)}</div>}
          <div className="flex flex-col gap-2 sm:flex-row">
            {r.certificateId && <Link href="/sertifikat" className="btn-solid">Lihat sertifikat</Link>}
            {r.canCancel && <button className="btn-outline" onClick={() => cancel(r.id)}>Ubah jadwal / batalkan</button>}
          </div>
          {!r.canCancel && ["submitted", "confirmed"].includes(r.status) && <p className="text-xs text-ink-soft">Perubahan jadwal hanya bisa sampai {data.rescheduleDays} hari sebelum tes.</p>}
        </section>
      ))}

      {!canRegister && active.length === 0 && (
        <section className="card text-center"><p className="font-semibold text-navy">Kamu belum punya jatah pendaftaran ITP.</p><p className="mt-1 text-sm text-ink-soft">Beli pendaftaran ITP, bundle, atau Paket Journey untuk mendaftar tes resmi.</p><Link href="/paket" className="btn-solid mt-4">Lihat paket</Link></section>
      )}

      {canRegister && (
        <section className="card">
          <p className="rounded-lg bg-brand-tint p-3 text-sm">Pendaftaran ITP resmi sudah dibayar. Jatah tersisa: <b>{data.itpRemaining}</b>. Pilih jadwal dan lengkapi data peserta.</p>
          {data.advice && <p className="mt-3 rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">Saran Konselor: jadwalkan minimal <b>{data.advice.weeks} minggu</b> lagi ({data.advice.basis}). Ini perkiraan, bukan jaminan skor.</p>}

          <ol className="mt-4 flex gap-2 text-sm" aria-label="Langkah pendaftaran">{["Pilih jadwal", "Data peserta", "Konfirmasi"].map((t, i) => <li key={t} className={`flex-1 rounded-lg px-3 py-2 text-center font-semibold ${step === i + 1 ? "bg-navy text-white" : step > i + 1 ? "bg-success-tint text-success" : "bg-canvas text-ink-soft"}`}>{i + 1}. {t}</li>)}</ol>

          {step === 1 && (
            <div className="mt-4 flex flex-col gap-3">
              {data.sessions.length === 0 && <p className="text-sm text-ink-soft">Belum ada jadwal terbuka. Pantau lagi nanti.</p>}
              {data.sessions.map((s) => (
                <button key={s.id} disabled={s.left === 0} onClick={() => { setSel(s); setF((x) => ({ ...x, fullName: x.fullName || me.data?.name || "" })); setStep(2); }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-[1.5px] border-line-strong p-4 text-left hover:border-brand disabled:opacity-50">
                  <div><p className="font-semibold text-navy">{s.title}</p><p className="text-sm text-ink-soft">{tgl(s.date, true)} · {s.place}</p>{s.tooSoon && <p className="mt-1 text-xs text-accent-dark">Lebih cepat dari saran Konselor</p>}</div>
                  <span className={s.left <= 5 ? "badge-warn" : "badge-ok"}>{s.left === 0 ? "Penuh" : `${s.left} kursi tersisa`}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && sel && (
            <div className="mt-4 flex flex-col gap-4">
              <p className="rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">Nama harus sama persis dengan KTP/paspor yang dibawa saat tes. Nama ini tercetak di sertifikat dan tidak bisa diubah setelah dikirim.</p>
              <label className={label}>Nama sesuai identitas<input className="field font-normal" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoComplete="name" /></label>
              <label className={label}>NIK / nomor paspor<input className="field font-normal" inputMode="numeric" value={f.nik} onChange={(e) => setF({ ...f, nik: e.target.value })} autoComplete="off" /><span className="text-xs font-normal text-ink-soft">NIK 16 digit atau nomor paspor. Disimpan terenkripsi.</span></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>Tanggal lahir<input className="field font-normal" type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></label>
                <label className={label}>Jenis kelamin<select className="field font-normal" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Pilih</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {([["idPhoto", "Unggah foto KTP/paspor"], ["facePhoto", "Unggah pas foto"]] as const).map(([k, t]) => (
                  <div key={k} className={label}>{t}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm font-normal" onChange={(e) => upload(k, e.target.files?.[0])} />
                    {up === (k === "idPhoto" ? "id" : "face") && <span className="text-xs font-normal text-ink-soft">Mengompres & mengunggah…</span>}
                    {f[k] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/assets/${f[k]}`} alt={t} className="mt-1 h-24 w-auto self-start rounded-lg border border-line object-cover" />}
                  </div>
                ))}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button className="btn-outline" onClick={() => setStep(1)}>← Ganti jadwal</button><button className="btn-solid" disabled={!step2ok || !!up} onClick={() => setStep(3)}>Lanjut</button></div>
            </div>
          )}

          {step === 3 && sel && (
            <div className="mt-4 flex flex-col gap-4">
              <dl className="grid gap-2 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-ink-soft">Jadwal</dt><dd className="font-semibold text-navy">{sel.title}<br />{tgl(sel.date, true)} · {sel.place}</dd></div>
                <div><dt className="text-ink-soft">Peserta</dt><dd className="font-semibold text-navy">{f.fullName}<br />NIK •••• {f.nik.slice(-4)} · {f.gender === "L" ? "Laki-laki" : "Perempuan"} · {f.birthDate}</dd></div>
              </dl>
              <div className="rounded-xl border border-line p-4 text-sm"><p className="font-semibold text-navy">Aturan hari-H</p><ul className="mt-1 text-ink-soft"><li>• Datang 30 menit sebelum mulai</li><li>• Bawa KTP/paspor asli yang sama dengan data</li><li>• Bawa pensil 2B dan penghapus (tes paper-based)</li><li>• Ponsel dan tas dititipkan</li></ul></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /><span>Data saya sudah benar dan sesuai identitas.</span></label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button className="btn-outline" onClick={() => setStep(2)}>← Ubah data</button><button className="btn-accent" disabled={!f.agree || busy} onClick={submit}>{busy ? "Mengirim…" : "Konfirmasi Pendaftaran"}</button></div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

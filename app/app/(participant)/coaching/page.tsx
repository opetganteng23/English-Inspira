"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Open = { id: string; title: string; coach: string; startsAt: string; endsAt: string; mode: "online" | "offline"; room: string; left: number };
type Bk = { id: string; status: string; startsAt: string | null; endsAt: string | null; mode: string; meetingUrl: string; room: string; coach: string; quotaCharged: boolean; note: string; canCancel: boolean };
type D = { quota: { total: number; used: number; bookable: number } | null; rules: { registerBeforeHours: number; cancelBeforeHours: number }; open: Open[]; bookings: Bk[] };
const ST: Record<string, [string, string]> = { booked: ["Terjadwal", "badge-ok"], present: ["Hadir", "badge-ok"], absent: ["Tidak hadir", "badge-bad"], excused: ["Izin", "badge-muted"], cancelled: ["Dibatalkan", "badge-muted"] };

export default function Coaching() {
  const { data, loading, error, reload } = useApi<D>("/api/coaching");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); setErr(""); try { await fn(); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } };

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote text={error} />;
  const upcoming = data.bookings.filter((b) => b.status === "booked");
  const past = data.bookings.filter((b) => b.status !== "booked" && b.status !== "cancelled");
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="page-title">Coaching</h1><p className="mt-1 text-ink-soft">Pesan sesi dengan coach institusimu. Kuota dipakai saat kamu hadir atau tidak hadir tanpa izin.</p></div>
      <ErrorNote text={err} />

      {!data.quota ? <Empty>Kuota coaching terbit setelah placement test selesai.</Empty> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">TOTAL</p><p className="font-display text-2xl font-extrabold text-navy">{data.quota.total}</p></div>
            <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">TERPAKAI</p><p className="font-display text-2xl font-extrabold text-navy">{data.quota.used}</p></div>
            <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">BISA DIPESAN</p><p className="font-display text-2xl font-extrabold text-navy">{data.quota.bookable}</p></div>
          </div>

          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Sesi saya</h2>
            {upcoming.length ? (
              <ul className="mt-2 divide-y divide-line">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span><b className="text-navy">{b.startsAt ? tgl(b.startsAt, true) : "-"}</b> · {b.coach}<br /><span className="text-xs text-ink-soft">{b.mode === "online" ? (b.meetingUrl ? <a className="text-brand underline" href={b.meetingUrl} target="_blank" rel="noopener noreferrer">Buka tautan pertemuan</a> : "Online") : `Tatap muka${b.room ? ` · ${b.room}` : ""}`}</span></span>
                    {b.canCancel ? <button className="btn-outline !min-h-[40px]" disabled={busy === b.id} onClick={() => confirm("Batalkan sesi ini? Kuotamu tidak berkurang.") && run(b.id, () => api(`/api/coaching/bookings/${b.id}/cancel`, { json: {} }))}>Batalkan</button> : <span className="text-xs text-ink-soft">Batal mandiri maks {data.rules.cancelBeforeHours} jam sebelum sesi; hubungi coach.</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-soft">Belum ada sesi terjadwal.</p>}
          </section>

          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Slot tersedia</h2>
            <p className="text-sm text-ink-soft">Pendaftaran ditutup {data.rules.registerBeforeHours} jam sebelum sesi.</p>
            {data.open.length ? (
              <ul className="mt-2 divide-y divide-line">
                {data.open.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span><b className="text-navy">{tgl(s.startsAt, true)}</b> · {s.coach}{s.title ? ` · ${s.title}` : ""}<br /><span className="text-xs text-ink-soft">{s.mode === "online" ? "Online" : `Tatap muka${s.room ? ` · ${s.room}` : ""}`} · sisa {s.left} kursi</span></span>
                    <button className="btn-solid !min-h-[40px]" disabled={busy === s.id || data.quota!.bookable <= 0} onClick={() => run(s.id, () => api("/api/coaching/book", { json: { slotId: s.id } }))}>Pesan</button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-soft">Belum ada slot terbuka. Coach akan menerbitkan jadwal.</p>}
            {data.quota.bookable <= 0 && data.open.length > 0 && <p className="mt-2 text-xs text-ink-soft">Kuota yang bisa dipesan habis (termasuk sesi yang sudah kamu pesan).</p>}
          </section>

          {past.length > 0 && (
            <section className="card">
              <h2 className="font-display text-lg font-extrabold text-navy">Riwayat sesi</h2>
              <ul className="mt-2 divide-y divide-line">
                {past.map((b) => (
                  <li key={b.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span><b className="text-navy">{b.startsAt ? tgl(b.startsAt, true) : "-"}</b> · {b.coach}</span><span className={ST[b.status]?.[1] ?? "badge-muted"}>{ST[b.status]?.[0] ?? b.status}</span></div>
                    {b.note && <p className="mt-1 rounded-lg bg-canvas p-3 text-ink-soft"><b className="text-navy">Catatan coach:</b> {b.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

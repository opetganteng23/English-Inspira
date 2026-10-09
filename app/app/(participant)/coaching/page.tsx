"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Open = { id: string; title: string; coach: string; startsAt: string; endsAt: string; mode: "online" | "offline"; room: string; left: number };
type Bk = { id: string; status: string; startsAt: string | null; endsAt: string | null; mode: string; meetingUrl: string; room: string; coach: string; quotaCharged: boolean; note: string; canCancel: boolean };
type D = { quota: { total: number; used: number; bookable: number } | null; rules: { registerBeforeHours: number; cancelBeforeHours: number }; open: Open[]; bookings: Bk[] };
const ST: Record<string, [string, string]> = { booked: ["Scheduled", "badge-ok"], present: ["Present", "badge-ok"], absent: ["Absent", "badge-bad"], excused: ["Excused", "badge-muted"], cancelled: ["Cancelled", "badge-muted"] };

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
      <div><h1 className="page-title">Coaching</h1><p className="mt-1 text-ink-soft">Book sessions with your institution’s coach. Quota is used when you attend or are absent without notice.</p></div>
      <ErrorNote text={err} />

      {!data.quota ? <Empty>Your coaching quota becomes available after the placement test.</Empty> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">TOTAL</p><p className="font-display text-2xl font-extrabold text-navy">{data.quota.total}</p></div>
            <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">USED</p><p className="font-display text-2xl font-extrabold text-navy">{data.quota.used}</p></div>
            <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">BOOKABLE</p><p className="font-display text-2xl font-extrabold text-navy">{data.quota.bookable}</p></div>
          </div>

          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">My sessions</h2>
            {upcoming.length ? (
              <ul className="mt-2 divide-y divide-line">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span><b className="text-navy">{b.startsAt ? tgl(b.startsAt, true) : "-"}</b> · {b.coach}<br /><span className="text-xs text-ink-soft">{b.mode === "online" ? (b.meetingUrl ? <a className="text-brand underline" href={b.meetingUrl} target="_blank" rel="noopener noreferrer">Open meeting link</a> : "Online") : `In person${b.room ? ` · ${b.room}` : ""}`}</span></span>
                    {b.canCancel ? <button className="btn-outline !min-h-[40px]" disabled={busy === b.id} onClick={() => confirm("Cancel this session? Your quota is not reduced.") && run(b.id, () => api(`/api/coaching/bookings/${b.id}/cancel`, { json: {} }))}>Cancel</button> : <span className="text-xs text-ink-soft">Self-cancel up to {data.rules.cancelBeforeHours} hours before the session; contact your coach after that.</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-soft">No scheduled sessions yet.</p>}
          </section>

          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Available slots</h2>
            <p className="text-sm text-ink-soft">Booking closes {data.rules.registerBeforeHours} hours before the session.</p>
            {data.open.length ? (
              <ul className="mt-2 divide-y divide-line">
                {data.open.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span><b className="text-navy">{tgl(s.startsAt, true)}</b> · {s.coach}{s.title ? ` · ${s.title}` : ""}<br /><span className="text-xs text-ink-soft">{s.mode === "online" ? "Online" : `In person${s.room ? ` · ${s.room}` : ""}`} · {s.left} seats left</span></span>
                    <button className="btn-solid !min-h-[40px]" disabled={busy === s.id || data.quota!.bookable <= 0} onClick={() => run(s.id, () => api("/api/coaching/book", { json: { slotId: s.id } }))}>Messages</button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-soft">No open slots yet. Your coach will publish a schedule.</p>}
            {data.quota.bookable <= 0 && data.open.length > 0 && <p className="mt-2 text-xs text-ink-soft">No bookable quota left (including sessions you have already booked).</p>}
          </section>

          {past.length > 0 && (
            <section className="card">
              <h2 className="font-display text-lg font-extrabold text-navy">Session history</h2>
              <ul className="mt-2 divide-y divide-line">
                {past.map((b) => (
                  <li key={b.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span><b className="text-navy">{b.startsAt ? tgl(b.startsAt, true) : "-"}</b> · {b.coach}</span><span className={ST[b.status]?.[1] ?? "badge-muted"}>{ST[b.status]?.[0] ?? b.status}</span></div>
                    {b.note && <p className="mt-1 rounded-lg bg-canvas p-3 text-ink-soft"><b className="text-navy">Coach’s note:</b> {b.note}</p>}
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

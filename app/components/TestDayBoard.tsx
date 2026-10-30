"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type P = { userId: string; name: string | null; email: string; phone: string | null; attemptId: string | null; lastSeen: string | null };
type S = { id: string; label: string; opensAt: string; closesAt: string; capacity: number; state: "upcoming" | "open" | "closed"; notStarted: P[]; running: P[]; offline: P[]; done: P[] };
const time = (d: string) => new Date(d).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const STATE: Record<S["state"], [string, string]> = { open: ["Open now", "badge-ok"], upcoming: ["Upcoming", "badge-muted"], closed: ["Closed", "badge-muted"] };

/** Hari tes dalam satu layar: pilih sesi, lihat siapa belum masuk, sedang mengerjakan, terputus, selesai; klik nama untuk bertindak. */
export function TestDayBoard({ testId }: { testId: string }) {
  const [data, setData] = useState<{ sessions: S[]; at: string } | null>(null);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const load = () => api<{ sessions: S[]; at: string }>(`/api/admin/tests/${testId}/live`, { silent: true }).then((d) => { setData(d); setErr(""); }).catch((e) => setErr((e as Error).message));
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [testId]);
  // Sesi bawaan: yang sedang dibuka, lalu yang berikutnya, lalu yang terakhir.
  const current = useMemo(() => {
    const ss = data?.sessions ?? [];
    return ss.find((s) => s.id === pick) ?? ss.find((s) => s.state === "open") ?? ss.find((s) => s.state === "upcoming") ?? ss[ss.length - 1];
  }, [data, pick]);

  if (!data) return err ? <ErrorNote text={err} /> : <Loading />;
  if (!data.sessions.length) return <p className="card text-sm text-ink-soft">No sessions yet. Create sessions in the Schedule tab; test day status appears here.</p>;
  const s = current!;
  const total = s.notStarted.length + s.running.length + s.offline.length + s.done.length;
  const rx = q.trim().toLowerCase();
  const f = (l: P[]) => (rx ? l.filter((p) => `${p.name ?? ""} ${p.email}`.toLowerCase().includes(rx)) : l);
  const col = (title: string, list: P[], tone: string, hint: string, action: (p: P) => React.ReactNode) => (
    <section className="card flex min-h-0 flex-col !p-3">
      <h3 className="flex items-baseline justify-between font-display font-extrabold text-navy"><span>{title}</span><span className={`rounded-full px-2 py-0.5 text-sm ${tone}`}>{list.length}</span></h3>
      <p className="mb-2 text-xs text-ink-soft">{hint}</p>
      <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
        {f(list).map((p) => (
          <li key={p.userId} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-2 py-1.5 text-sm">
            <Link href={`/admin/participants/${p.userId}#admin-actions`} className="min-w-0 truncate font-semibold text-navy hover:text-brand" title={p.email}>{p.name || p.email}</Link>
            <span className="shrink-0 text-xs">{action(p)}</span>
          </li>
        ))}
        {f(list).length === 0 && <li className="p-2 text-center text-xs text-ink-soft">{rx ? "No match" : "Nobody"}</li>}
      </ul>
    </section>
  );
  const wa = (p: P) => p.phone ? <a className="font-semibold text-brand" target="_blank" rel="noopener" href={`https://wa.me/${p.phone.replace(/\D/g, "").replace(/^0/, "62")}`}>WhatsApp</a> : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-auto" value={s.id} onChange={(e) => setPick(e.target.value)} aria-label="Session">
          {data.sessions.map((x) => <option key={x.id} value={x.id}>{x.label} · {time(x.opensAt)}{x.state === "open" ? " · open now" : ""}</option>)}
        </select>
        <span className={STATE[s.state][1]}>{STATE[s.state][0]}</span>
        <span className="text-sm text-ink-soft">{time(s.opensAt)} – {time(s.closesAt)} WIB · {total}/{s.capacity} seats</span>
        <input className="field !h-10 ml-auto w-full sm:w-56" placeholder="Find a participant" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a participant" />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
        {total > 0 && <div className="flex h-full">
          <span className="bg-success" style={{ width: `${(s.done.length / total) * 100}%` }} />
          <span className="bg-brand" style={{ width: `${(s.running.length / total) * 100}%` }} />
          <span className="bg-red-600" style={{ width: `${(s.offline.length / total) * 100}%` }} />
        </div>}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {col("Not started", s.notStarted, "bg-canvas text-navy", s.state === "open" ? "Session is open but they have not started. Contact them." : "Has a seat, no attempt yet.", wa)}
        {col("Taking the test", s.running, "bg-brand-tint text-brand", "Connected now.", (p) => p.attemptId && <Link className="font-semibold text-brand" href={`/admin/proctoring/${p.attemptId}`}>Trace</Link>)}
        {col("Disconnected", s.offline, "bg-red-50 text-red-700", "No signal for over 90 seconds. Lost time is given back when they return.", (p) => <>{p.attemptId && <Link className="mr-2 font-semibold text-brand" href={`/admin/proctoring/${p.attemptId}`}>Trace</Link>}{wa(p)}</>)}
        {col("Finished", s.done, "bg-success-tint text-success", "Submitted.", () => null)}
      </div>
      <p className="text-xs text-ink-soft">Refreshes every 20 seconds. Click a name for schedule changes, extra time, or resetting an attempt. Cheating flags and screens are in <Link href="/admin/proctoring" className="font-semibold text-brand">Monitoring & Proctoring</Link>.</p>
    </div>
  );
}

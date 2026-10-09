"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type Bk = { id: string; userId: string; name: string; status: string; quotaCharged: boolean; note: { private: string; shared: string; recommendLevelUp: boolean } | null };
type S = { id: string; title: string; startsAt: string; endsAt: string; mode: string; room: string; bookings: Bk[] };
const ST: Record<string, [string, string]> = { booked: ["Terjadwal", "badge-warn"], present: ["Hadir", "badge-ok"], absent: ["Tidak hadir", "badge-bad"], excused: ["Izin", "badge-muted"] };

export default function Sesi() {
  const { data, loading, error, reload } = useApi<{ sessions: S[] }>("/api/coach/sessions");
  const [err, setErr] = useState("");
  const [noteFor, setNoteFor] = useState<Bk | null>(null);
  const mark = async (id: string, status: string) => { setErr(""); try { await api(`/api/coach/bookings/${id}`, { json: { status } }); reload(); } catch (e) { setErr((e as Error).message); } };

  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Sesi & kehadiran</h1><p className="text-sm text-ink-soft">Catat kehadiran setelah sesi dimulai. Hadir dan tidak hadir memakai kuota; izin tidak. Koreksi aman dilakukan, kuota menyesuaikan sendiri.</p></div>
      <ErrorNote text={error || err} />
      {data?.sessions.length === 0 && <Empty>Belum ada sesi yang dipesan peserta.</Empty>}
      {data?.sessions.map((s) => (
        <section key={s.id} className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">{tgl(s.startsAt, true)}{s.title ? ` · ${s.title}` : ""}</h2>
          <p className="text-sm text-ink-soft">{s.mode === "online" ? "Online" : `Tatap muka${s.room ? ` · ${s.room}` : ""}`}</p>
          <ul className="mt-2 divide-y divide-line">
            {s.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0"><Link className="font-semibold text-brand" href={`/coach/peserta/${b.userId}`}>{b.name}</Link> <span className={ST[b.status]?.[1] ?? "badge-muted"}>{ST[b.status]?.[0] ?? b.status}</span>{b.note?.recommendLevelUp && <span className="badge-ok ml-1">rekomendasi naik level</span>}</span>
                <span className="flex flex-wrap gap-2">
                  {(["present", "absent", "excused"] as const).map((st) => <button key={st} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${b.status === st ? "border-navy bg-navy text-white" : "border-line-strong text-navy"}`} onClick={() => mark(b.id, st)}>{ST[st][0]}</button>)}
                  <button className="rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-brand" onClick={() => setNoteFor(b)}>{b.note ? "Ubah catatan" : "Catatan"}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {noteFor && <NoteEditor b={noteFor} onClose={() => setNoteFor(null)} onSaved={() => { setNoteFor(null); reload(); }} />}
    </div>
  );
}

function NoteEditor({ b, onClose, onSaved }: { b: Bk; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ private: b.note?.private ?? "", shared: b.note?.shared ?? "", recommendLevelUp: b.note?.recommendLevelUp ?? false });
  const [err, setErr] = useState("");
  async function save() { try { await api(`/api/coach/bookings/${b.id}/note`, { method: "PUT", json: { private: v.private || undefined, shared: v.shared || undefined, recommendLevelUp: v.recommendLevelUp } }); onSaved(); } catch (e) { setErr((e as Error).message); } }
  return (
    <Modal title={`Catatan sesi: ${b.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Catatan untuk peserta (terlihat peserta)<textarea className="field h-24 py-2 font-normal" value={v.shared} onChange={(e) => setV({ ...v, shared: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Catatan pribadi coach (tidak terlihat peserta maupun admin institusi)<textarea className="field h-24 py-2 font-normal" value={v.private} onChange={(e) => setV({ ...v, private: e.target.value })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.recommendLevelUp} onChange={(e) => setV({ ...v, recommendLevelUp: e.target.checked })} />Rekomendasikan naik level</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" onClick={save}>Simpan</button></div>
      </div>
    </Modal>
  );
}

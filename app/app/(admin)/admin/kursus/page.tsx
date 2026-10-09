"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Unit = { id: string; title: string; description: string; order: number; active: boolean; materialIds: string[]; quizTestId: string | null };
type Course = { id: string; levelId: string; title: string; description: string; order: number; active: boolean; units: Unit[] };
type Data = { levels: { id: string; name: string }[]; materials: { id: string; title: string; status: string; kind: string }[]; quizzes: { id: string; name: string; unitId: string | null }[]; courses: Course[] };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Kursus() {
  const { data, loading, error, reload } = useApi<Data>("/api/admin/courses");
  const [course, setCourse] = useState<Partial<Course> | null>(null);
  const [unit, setUnit] = useState<(Partial<Unit> & { courseId: string }) | null>(null);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr((e as Error).message); } };

  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Kursus & Unit</h1><p className="text-sm text-ink-soft">Susun Level → Course → Unit. Unit selesai bila semua materi wajib selesai dan kuisnya lulus (batas lulus di Parameter Sistem).</p></div>
        <button className="btn-solid" onClick={() => setCourse({ active: true, order: 0, levelId: data?.levels[0]?.id })}>+ Course baru</button>
      </div>
      <ErrorNote text={error || err} />
      {data?.levels.map((l) => {
        const cs = data.courses.filter((c) => c.levelId === l.id);
        return (
          <section key={l.id} className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-extrabold text-navy">{l.name}</h2>
            {cs.length === 0 && <p className="text-sm text-ink-soft">Belum ada course untuk level ini.</p>}
            {cs.map((c) => (
              <div key={c.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><b className="text-navy">{c.title}</b> {!c.active && <span className="badge-muted ml-1">nonaktif</span>}{c.description && <p className="text-sm text-ink-soft">{c.description}</p>}</div>
                  <div className="flex gap-3 text-sm font-semibold"><button className="text-brand" onClick={() => setUnit({ courseId: c.id, active: true, order: c.units.length, materialIds: [] })}>+ Unit</button><button className="text-brand" onClick={() => setCourse(c)}>Edit</button><button className="text-red-700" onClick={() => confirm("Hapus course ini?") && run(() => api(`/api/admin/courses/${c.id}`, { method: "DELETE" }))}>Hapus</button></div>
                </div>
                <ul className="mt-3 divide-y divide-line">
                  {c.units.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span><b className="text-navy">{u.order}. {u.title}</b>{!u.active && <span className="badge-muted ml-2">nonaktif</span>}<br /><span className="text-xs text-ink-soft">{u.materialIds.length} materi wajib{u.quizTestId ? " · ada kuis" : ""}</span></span>
                      <span className="flex gap-3 font-semibold"><button className="text-brand" onClick={() => setUnit({ ...u, courseId: c.id })}>Edit</button><button className="text-red-700" onClick={() => confirm("Hapus unit ini?") && run(() => api(`/api/admin/units/${u.id}`, { method: "DELETE" }))}>Hapus</button></span>
                    </li>
                  ))}
                  {c.units.length === 0 && <li className="py-2 text-sm text-ink-soft">Belum ada unit.</li>}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      <RemedialMapSection />

      {course && data && <CourseEditor init={course} levels={data.levels} onClose={() => setCourse(null)} onSaved={() => { setCourse(null); reload(); }} />}
      {unit && data && <UnitEditor init={unit} data={data} onClose={() => setUnit(null)} onSaved={() => { setUnit(null); reload(); }} />}
    </div>
  );
}

type RM = { entries: { id: string; skill: string; topic: string; unitId: string; unit: string }[]; units: { id: string; label: string }[]; topics: { skill: string; topic: string; questions: number }[] };

/** Peta remedial: topik lemah → unit. Dipakai study plan untuk menautkan item rencana ke unit perbaikan. */
function RemedialMapSection() {
  const { data, error, reload } = useApi<RM>("/api/admin/remedial-map");
  const [v, setV] = useState({ key: "", unitId: "" });
  const [err, setErr] = useState("");
  async function add() {
    const [skill, topic] = v.key.split("|");
    setErr("");
    try { await api("/api/admin/remedial-map", { json: { skill, topic, unitId: v.unitId } }); setV({ key: "", unitId: "" }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <section className="card flex flex-col gap-3">
      <div><h2 className="font-display text-lg font-extrabold text-navy">Peta remedial</h2><p className="text-sm text-ink-soft">Topik yang lemah diarahkan ke unit perbaikan. Item rencana belajar peserta otomatis menampilkan tombol “Buka unit”.</p></div>
      <ErrorNote text={err || error} />
      <ul className="divide-y divide-line text-sm">
        {data?.entries.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b className="text-navy">{e.topic}</b> <span className="text-xs text-ink-soft">({e.skill})</span> → {e.unit}</span><button className="font-semibold text-red-700" onClick={() => api(`/api/admin/remedial-map/${e.id}`, { method: "DELETE" }).then(reload).catch((x) => setErr(x.message))}>Hapus</button></li>)}
        {data?.entries.length === 0 && <li className="py-2 text-ink-soft">Belum ada pemetaan.</li>}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select aria-label="Topik" className="field" value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })}><option value="">Pilih topik (dari tag soal)</option>{data?.topics.map((t) => <option key={t.skill + t.topic} value={`${t.skill}|${t.topic}`}>{t.topic} ({t.skill}, {t.questions} soal)</option>)}</select>
        <select aria-label="Unit" className="field" value={v.unitId} onChange={(e) => setV({ ...v, unitId: e.target.value })}><option value="">Pilih unit</option>{data?.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
        <button className="btn-outline" disabled={!v.key || !v.unitId} onClick={add}>Tambah</button>
      </div>
    </section>
  );
}

function CourseEditor({ init, levels, onClose, onSaved }: { init: Partial<Course>; levels: Data["levels"]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ levelId: init.levelId ?? levels[0]?.id ?? "", title: init.title ?? "", description: init.description ?? "", order: init.order ?? 0, active: init.active ?? true });
  const [err, setErr] = useState("");
  async function save() {
    try { await api(init.id ? `/api/admin/courses/${init.id}` : "/api/admin/courses", { method: init.id ? "PATCH" : "POST", json: { ...v, order: Number(v.order), description: v.description || undefined } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={init.id ? "Edit course" : "Course baru"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Level<select className="field font-normal" value={v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })}>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className={label}>Judul<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className={label}>Deskripsi<textarea className="field h-20 py-2 font-normal" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <label className={label}>Urutan<input className="field font-normal" type="number" min={0} value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Aktif</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" disabled={!v.title.trim()} onClick={save}>Simpan</button></div>
      </div>
    </Modal>
  );
}

function UnitEditor({ init, data, onClose, onSaved }: { init: Partial<Unit> & { courseId: string }; data: Data; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: init.title ?? "", description: init.description ?? "", order: init.order ?? 0, active: init.active ?? true, materialIds: init.materialIds ?? [], quizTestId: init.quizTestId ?? "" });
  const [err, setErr] = useState("");
  const toggle = (id: string) => setV((x) => ({ ...x, materialIds: x.materialIds.includes(id) ? x.materialIds.filter((m) => m !== id) : [...x.materialIds, id] }));
  async function save() {
    try { await api(init.id ? `/api/admin/units/${init.id}` : "/api/admin/units", { method: init.id ? "PATCH" : "POST", json: { courseId: init.courseId, ...v, order: Number(v.order), description: v.description || undefined, quizTestId: v.quizTestId || null } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  const freeQuizzes = data.quizzes.filter((q) => !q.unitId || q.unitId === init.id);
  return (
    <Modal title={init.id ? "Edit unit" : "Unit baru"} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <label className={label}>Judul unit<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className={label}>Deskripsi<textarea className="field h-16 py-2 font-normal" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Urutan<input className="field font-normal" type="number" min={0} value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} /></label>
          <label className={label}>Kuis unit<select className="field font-normal" value={v.quizTestId} onChange={(e) => setV({ ...v, quizTestId: e.target.value })}><option value="">Tanpa kuis</option>{freeQuizzes.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label>
        </div>
        <fieldset><legend className="mb-1 text-sm font-semibold text-navy">Materi wajib ({v.materialIds.length})</legend>
          <ul className="max-h-56 overflow-y-auto rounded-lg border border-line">
            {data.materials.map((m) => (
              <li key={m.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-0"><input type="checkbox" className="h-5 w-5" checked={v.materialIds.includes(m.id)} onChange={() => toggle(m.id)} /><span className="flex-1">{m.title}</span>{m.status !== "published" && <span className="badge-warn">belum terbit</span>}</label></li>
            ))}
            {data.materials.length === 0 && <li className="p-3 text-sm text-ink-soft">Belum ada materi.</li>}
          </ul>
          <p className="mt-1 text-xs text-ink-soft">Materi yang belum terbit tidak tampil ke peserta sampai diterbitkan. Kuis dibuat di menu Tes dengan jenis “Kuis unit”.</p>
        </fieldset>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Aktif</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" disabled={!v.title.trim()} onClick={save}>Simpan</button></div>
      </div>
    </Modal>
  );
}

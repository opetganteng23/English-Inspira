"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Q = { id: string; groupId: string | null; stem: string; options: string[] };
type G = { id: string; instruction?: string; passageTitle?: string; passageHtml?: string; audio: { id: string; finished: boolean } | null };
type State = {
  status: "in_progress" | "submitted"; testName: string;
  section: { index: number; total: number; name: string };
  remainingSec: number; groups: G[]; questions: Q[]; answers: { qid: string; choice: number | null; flagged: boolean }[];
};

const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & Written Expression", reading: "Reading" };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Ruang({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [st, setSt] = useState<State | null>(null);
  const [err, setErr] = useState("");
  const [cur, setCur] = useState(0);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState<"ok" | "saving" | "fail">("ok");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef<Set<string>>(new Set());
  const pendingFlags = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const t0 = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    const r = await fetch(`/api/attempts/${params.id}`);
    const d = await r.json();
    if (!r.ok) return setErr(d.error ?? "Gagal memuat tes");
    if (d.status === "submitted") return router.replace(`/hasil/${params.id}`);
    setSt(d); setCur(0); setLeft(d.remainingSec); setConfirm(false);
    setAns(Object.fromEntries(d.answers.filter((a: { choice: number | null }) => a.choice != null).map((a: { qid: string; choice: number }) => [a.qid, a.choice])));
    setFlagged(Object.fromEntries(d.answers.map((a: { qid: string; flagged: boolean }) => [a.qid, a.flagged])));
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  const flush = useCallback(async () => {
    if (!dirty.current.size && !pendingFlags.current.length) return true;
    const ids = Array.from(dirty.current); dirty.current.clear();
    const flags = pendingFlags.current.splice(0);
    setSaved("saving");
    try {
      const r = await fetch(`/api/attempts/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: ids.map((qid) => ({ qid, choice: ansRef.current[qid] ?? null, flagged: !!flagRef.current[qid], timeSpentSec: Math.round((Date.now() - (t0.current[qid] ?? Date.now())) / 1000) })),
          flags,
        }),
      });
      if (r.status === 409) { await load(); return false; } // waktu section habis di server
      if (!r.ok) throw new Error();
      setSaved("ok"); return true;
    } catch { ids.forEach((i) => dirty.current.add(i)); flags.forEach((f) => pendingFlags.current.push(f)); setSaved("fail"); return false; }
  }, [params.id, load]);

  const ansRef = useRef(ans); ansRef.current = ans;
  const flagRef = useRef(flagged); flagRef.current = flagged;
  const queue = (qid: string) => { dirty.current.add(qid); clearTimeout(timer.current); timer.current = setTimeout(flush, 2000); };

  // Hitung mundur lokal; sumber kebenaran tetap server (sinkron lewat load()).
  useEffect(() => {
    if (!st) return;
    const iv = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [st]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (st && left === 0) void next(true); }, [left]);

  // Proctoring ringan: hanya mencatat, tanpa kamera/mikrofon.
  useEffect(() => {
    const add = (k: string) => { pendingFlags.current.push(k); clearTimeout(timer.current); timer.current = setTimeout(flush, 500); };
    const vis = () => document.hidden && add("tab_hidden");
    const fs = () => !document.fullscreenElement && add("fullscreen_exit");
    const paste = () => add("paste");
    document.addEventListener("visibilitychange", vis); document.addEventListener("fullscreenchange", fs); document.addEventListener("paste", paste);
    return () => { document.removeEventListener("visibilitychange", vis); document.removeEventListener("fullscreenchange", fs); document.removeEventListener("paste", paste); };
  }, [flush]);

  async function next(auto = false) {
    if (busy) return; setBusy(true);
    await flush();
    const r = await fetch(`/api/attempts/${params.id}/advance`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok && !auto) return setErr(d.error ?? "Gagal");
    if (d.status === "submitted") return router.replace(`/hasil/${params.id}`);
    await load();
  }

  if (err) return <Center><p className="text-red-700">{err}</p></Center>;
  if (!st) return <Center>Memuat tes…</Center>;

  const q = st.questions[cur];
  const group = st.groups.find((g) => g.id === q.groupId);
  const last = st.section.index + 1 >= st.section.total;
  const choose = (i: number) => { setAns((a) => ({ ...a, [q.id]: i })); t0.current[q.id] ??= Date.now(); queue(q.id); };
  const toggleFlag = () => { setFlagged((f) => ({ ...f, [q.id]: !f[q.id] })); queue(q.id); };
  const answered = Object.keys(ans).filter((id) => st.questions.some((x) => x.id === id)).length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-navy px-6 py-3 text-white">
        <div className="flex items-center gap-4">
          <span className="font-display font-extrabold">{st.testName}</span>
          <span className="text-sm text-mist">Section {st.section.index + 1}/{st.section.total} · {LABEL[st.section.name]}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={saved === "fail" ? "text-orange-300" : "text-mist"}>{saved === "saving" ? "Menyimpan…" : saved === "fail" ? "Gagal menyimpan, mencoba lagi" : "✓ Tersimpan otomatis"}</span>
          <span className={`rounded-lg px-3 py-1.5 font-display text-lg font-extrabold ${left < 60 ? "bg-accent" : "bg-navy-700"}`} aria-label="Sisa waktu section">{mmss(left)}</span>
          <button className="rounded-lg border border-white/40 px-3 py-1.5 text-xs" onClick={() => document.documentElement.requestFullscreen?.()}>Layar penuh</button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-6 lg:grid-cols-[1fr_280px]">
        <main className="flex flex-col gap-5">
          {group?.audio && <AudioBox attemptId={params.id} audioId={group.audio.id} finished={group.audio.finished} instruction={group.instruction} />}
          {group?.passageHtml && (
            <article className="rounded-2xl border border-line bg-white p-5">
              <h3 className="mb-2 font-display font-extrabold text-navy">{group.passageTitle}</h3>
              {/* passageHtml disanitasi di server saat disimpan (Fase 5: sanitize-html) */}
              <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: group.passageHtml }} />
            </article>
          )}
          <section className="rounded-2xl border border-line bg-white p-6">
            <p className="text-sm text-ink-soft">Soal {cur + 1} dari {st.questions.length}</p>
            <h2 className="mt-2 text-lg font-medium leading-relaxed">{q.stem}</h2>
            <div role="radiogroup" className="mt-5 flex flex-col gap-3">
              {q.options.map((o, i) => (
                <button key={i} role="radio" aria-checked={ans[q.id] === i} onClick={() => choose(i)}
                  className={`flex items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition ${ans[q.id] === i ? "border-brand bg-brand-tint" : "border-line-strong hover:border-brand"}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold">{"ABCDEF"[i]}</span>{o}
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button disabled={cur === 0} onClick={() => setCur(cur - 1)} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold disabled:opacity-40">← Sebelumnya</button>
              <button onClick={toggleFlag} className="text-sm font-semibold text-accent-dark">{flagged[q.id] ? "★ Ditandai" : "☆ Tandai"}</button>
              {cur < st.questions.length - 1
                ? <button onClick={() => setCur(cur + 1)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Berikutnya →</button>
                : <button onClick={() => setConfirm(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{last ? "Selesai & kumpulkan" : "Selesaikan section"}</button>}
            </div>
          </section>
        </main>

        <aside className="h-fit rounded-2xl border border-line bg-white p-5">
          <h3 className="font-display font-extrabold text-navy">Navigator soal</h3>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {st.questions.map((x, i) => (
              <button key={x.id} onClick={() => setCur(i)} aria-label={`Soal ${i + 1}`}
                className={`h-9 rounded-lg text-sm font-semibold ${i === cur ? "ring-2 ring-brand " : ""}${flagged[x.id] ? "bg-accent-tint text-accent-dark" : ans[x.id] != null ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>{i + 1}</button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">{answered} dari {st.questions.length} dijawab · biru = dijawab, oranye = ditandai</p>
          <button onClick={() => setConfirm(true)} className="mt-4 w-full rounded-lg border border-line-strong py-2 text-sm font-semibold text-navy">{last ? "Kumpulkan tes" : "Selesaikan section"}</button>
        </aside>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="font-display text-xl font-extrabold text-navy">{last ? "Kumpulkan tes?" : "Selesaikan section ini?"}</h3>
            <p className="mt-2 text-sm text-ink-soft">
              {st.questions.length - answered > 0 ? `${st.questions.length - answered} soal belum dijawab. ` : ""}
              {last ? "Setelah dikumpulkan, jawaban tidak bisa diubah." : "Kamu tidak bisa kembali ke section ini."}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Kembali</button>
              <button disabled={busy} onClick={() => next()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Ya, lanjut</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center p-6 text-ink-soft">{children}</div>;

/** Mode tes: sekali putar, tanpa seek/jeda. Progres dilaporkan agar refresh melanjutkan, bukan mengulang. */
function AudioBox({ attemptId, audioId, finished, instruction }: { attemptId: string; audioId: string; finished: boolean; instruction?: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "done" | "error">(finished ? "done" : "idle");
  const [msg, setMsg] = useState("");
  const lastPos = useRef(0);
  const base = `/api/attempts/${attemptId}/audio/${audioId}`;

  async function start() {
    setMsg("");
    const r = await fetch(base, { method: "POST" });
    const d = await r.json();
    if (!r.ok) { setPhase(r.status === 403 ? "done" : "error"); return setMsg(d.error ?? "Gagal memuat audio"); }
    const a = el.current!; a.src = d.url; a.currentTime = d.startAtSec || 0;
    try { await a.play(); setPhase("playing"); } catch { setPhase("error"); setMsg("Browser memblokir pemutaran. Klik 'Mulai audio' lagi."); }
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      const a = el.current; if (!a) return;
      lastPos.current = Math.max(lastPos.current, a.currentTime);
      fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posSec: lastPos.current }) });
    }, 5000);
    return () => clearInterval(iv);
  }, [phase, base]);

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm font-semibold text-navy">{instruction ?? "Dengarkan audio"}</p>
      <audio ref={el} preload="auto" controlsList="nodownload noplaybackrate"
        onEnded={() => { setPhase("done"); fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posSec: el.current?.duration ?? lastPos.current, done: true }) }); }}
        onSeeking={() => { const a = el.current; if (a && a.currentTime > lastPos.current + 1) a.currentTime = lastPos.current; }} />
      {phase === "idle" && <button onClick={start} className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">▶ Mulai audio (hanya sekali)</button>}
      {phase === "playing" && <p className="mt-3 text-sm text-success">🔊 Audio sedang diputar. Tidak bisa dijeda atau diulang.</p>}
      {phase === "done" && <p className="mt-3 text-sm text-ink-soft">Audio sudah diputar.</p>}
      {phase === "error" && <button onClick={start} className="mt-3 rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold">Coba lagi</button>}
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
    </div>
  );
}

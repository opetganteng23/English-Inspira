"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

type Q = { id: string; groupId: string | null; stem: string; options: string[]; assetIds?: string[] };
type G = { id: string; instruction?: string; passageTitle?: string; passageHtml?: string; audio: { id: string; finished: boolean } | null };
type State = {
  status: "in_progress" | "submitted"; testName: string;
  section: { index: number; total: number; name: string };
  kind?: string; idleTimeoutSec?: number; remainingSec: number; groups: G[]; questions: Q[]; answers: { qid: string; choice: number | null; flagged: boolean; timeSpentSec?: number }[];
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
  const [navOpen, setNavOpen] = useState(false);

  const dirty = useRef<Set<string>>(new Set());
  const pendingFlags = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ansRef = useRef(ans); ansRef.current = ans;
  const flagRef = useRef(flagged); flagRef.current = flagged;
  // Waktu per soal: akumulasi detik saat soal tampil (dipakai analisis AI).
  const spent = useRef<Record<string, number>>({});
  const viewSince = useRef<{ qid: string; at: number } | null>(null);

  // Waktu aktif saja (MTS §13.1): detik dihitung per 1 dtk hanya bila tab terlihat dan ada interaksi dalam `idleTimeoutSec`
  // terakhir, atau audio sedang diputar. Waktu diam tidak dihitung ke soal.
  const lastInput = useRef(Date.now());
  const idleSec = useRef(60);
  const stopView = useCallback(() => { viewSince.current = null; }, []);
  useEffect(() => {
    const touch = () => { lastInput.current = Date.now(); };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const tick = setInterval(() => {
      const v = viewSince.current;
      if (!v || document.visibilityState !== "visible") return;
      const audioOn = Array.from(document.querySelectorAll("audio")).some((a) => !a.paused && !a.ended);
      if (audioOn || Date.now() - lastInput.current <= idleSec.current * 1000) spent.current[v.qid] = (spent.current[v.qid] ?? 0) + 1;
    }, 1000);
    return () => { clearInterval(tick); evs.forEach((e) => window.removeEventListener(e, touch)); };
  }, []);

  const load = useCallback(async () => {
    try {
      const d: State = await api(`/api/attempts/${params.id}`);
      if (d.status === "submitted") return router.replace(`/results/${params.id}`);
      if (typeof d.idleTimeoutSec === "number") idleSec.current = d.idleTimeoutSec;
      setSt(d); setCur(0); setLeft(d.remainingSec); setConfirm(false); spent.current = {};
      for (const a of d.answers) if (a.timeSpentSec) spent.current[a.qid] = a.timeSpentSec;
      setAns(Object.fromEntries(d.answers.filter((a) => a.choice != null).map((a) => [a.qid, a.choice as number])));
      setFlagged(Object.fromEntries(d.answers.map((a) => [a.qid, a.flagged])));
    } catch (e) { setErr((e as Error).message); }
  }, [params.id, router]);
  useEffect(() => { load(); }, [load]);

  // Lacak soal yang sedang tampil.
  useEffect(() => {
    if (!st) return;
    stopView();
    viewSince.current = { qid: st.questions[cur].id, at: Date.now() };
    return stopView;
  }, [st, cur, stopView]);

  const flush = useCallback(async () => {
    stopView();
    if (st) viewSince.current = { qid: st.questions[cur]?.id, at: Date.now() };
    if (!dirty.current.size && !pendingFlags.current.length) return true;
    const ids = Array.from(dirty.current); dirty.current.clear();
    const flags = pendingFlags.current.splice(0);
    setSaved("saving");
    try {
      await api(`/api/attempts/${params.id}`, {
        method: "PATCH",
        json: {
          answers: ids.map((qid) => ({ qid, choice: ansRef.current[qid] ?? null, flagged: !!flagRef.current[qid], timeSpentSec: Math.min(3600, Math.round(spent.current[qid] ?? 0)) })),
          flags,
        },
      });
      setSaved("ok"); return true;
    } catch (e) {
      if ((e as { status?: number }).status === 409) { await load(); return false; } // section habis di server
      ids.forEach((i) => dirty.current.add(i)); flags.forEach((f) => pendingFlags.current.push(f)); setSaved("fail"); return false;
    }
  }, [params.id, load, stopView, st, cur]);

  const queue = (qid: string) => { dirty.current.add(qid); clearTimeout(timer.current); timer.current = setTimeout(flush, 2000); };

  // Hitung mundur lokal; sumber kebenaran tetap server (disinkronkan lewat load()).
  useEffect(() => {
    if (!st) return;
    const iv = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [st]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (st && left === 0) void next(true); }, [left]);

  // Coba ulang simpan bila gagal (jaringan putus), dan peringatkan sebelum menutup halaman.
  useEffect(() => {
    if (saved !== "fail") return;
    const iv = setInterval(flush, 5000);
    return () => clearInterval(iv);
  }, [saved, flush]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current.size) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

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
    try {
      const d = await api(`/api/attempts/${params.id}/advance`, { json: {} });
      setBusy(false);
      if (d.status === "submitted") return router.replace(`/results/${params.id}`);
      await load();
    } catch (e) { setBusy(false); if (!auto) setErr((e as Error).message); else await load(); }
  }

  if (err) return <Center><div className="max-w-sm text-center"><p className="text-red-700">{err}</p><button className="btn-outline mt-4" onClick={() => { setErr(""); load(); }}>Reload</button></div></Center>;
  if (!st) return <Center>Loading test…</Center>;

  const q = st.questions[cur];
  const group = st.groups.find((g) => g.id === q.groupId);
  const last = st.section.index + 1 >= st.section.total;
  const choose = (i: number) => { setAns((a) => ({ ...a, [q.id]: i })); queue(q.id); };
  const toggleFlag = () => { setFlagged((f) => ({ ...f, [q.id]: !f[q.id] })); queue(q.id); };
  const answered = Object.keys(ans).filter((id) => st.questions.some((x) => x.id === id)).length;
  const finishLabel = last ? "Submit test" : "Finish section";

  const navigator = (
    <>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6">
        {st.questions.map((x, i) => (
          <button key={x.id} onClick={() => { setCur(i); setNavOpen(false); }} aria-label={`Question ${i + 1}${ans[x.id] != null ? ", answered" : ""}${flagged[x.id] ? ", flagged" : ""}`} aria-current={i === cur}
            className={`h-10 rounded-lg text-sm font-semibold ${i === cur ? "ring-2 ring-brand " : ""}${flagged[x.id] ? "bg-accent-tint text-accent-dark" : ans[x.id] != null ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>{i + 1}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-soft">{answered} of {st.questions.length} answered · blue = answered, orange = flagged</p>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col pb-24 lg:pb-0">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-navy px-4 py-2.5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold sm:text-base">{st.testName}</p>
          <p className="truncate text-xs text-mist">Section {st.section.index + 1}/{st.section.total} · {LABEL[st.section.name]}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`hidden sm:inline ${saved === "fail" ? "text-orange-300" : "text-mist"}`}>{saved === "saving" ? "Saving…" : saved === "fail" ? "Save failed, retrying" : "Saved automatically"}</span>
          <span className={`rounded-lg px-3 py-1.5 font-display text-lg font-extrabold ${left < 60 ? "bg-accent" : "bg-navy-700"}`} role="timer" aria-label="Section time remaining">{mmss(left)}</span>
          <button className="hidden rounded-lg border border-white/40 px-3 py-1.5 text-xs md:block" onClick={() => document.documentElement.requestFullscreen?.()}>Fullscreen</button>
        </div>
        {saved === "fail" && <p className="basis-full text-xs text-orange-300 sm:hidden">Save failed, retrying…</p>}
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
        <main className="flex min-w-0 flex-col gap-4">
          {group?.audio && (st.kind === "practice" ? <PracticeAudio key={group.audio.id} attemptId={params.id} audioId={group.audio.id} instruction={group.instruction} /> : <AudioBox attemptId={params.id} audioId={group.audio.id} finished={group.audio.finished} instruction={group.instruction} />)}
          {group?.passageHtml && (
            <article className="card max-h-[45vh] overflow-y-auto lg:max-h-none">
              <h3 className="mb-2 font-display font-extrabold text-navy">{group.passageTitle}</h3>
              {/* passageHtml disanitasi di server saat disimpan */}
              <div className="prose-ei" dangerouslySetInnerHTML={{ __html: group.passageHtml }} />
            </article>
          )}
          <section className="card">
            <p className="text-sm text-ink-soft">Question {cur + 1} of {st.questions.length}</p>
            <h2 className="mt-2 text-lg font-medium leading-relaxed">{q.stem}</h2>
            {q.assetIds?.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a} src={`/api/assets/${a}`} alt="Question image" className="mt-3 max-h-72 rounded-lg border border-line" />
            ))}
            <div role="radiogroup" aria-label="Answer options" className="mt-5 flex flex-col gap-3">
              {q.options.map((o, i) => (
                <button key={i} role="radio" aria-checked={ans[q.id] === i} onClick={() => choose(i)}
                  className={`flex min-h-[52px] items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition ${ans[q.id] === i ? "border-brand bg-brand-tint" : "border-line-strong hover:border-brand"}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold">{"ABCDEF"[i]}</span><span className="min-w-0">{o}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={toggleFlag} className="min-h-[44px] text-sm font-semibold text-accent-dark">{flagged[q.id] ? "★ Flagged" : "☆ Flag question"}</button>
              <button className="btn-outline hidden lg:inline-flex" onClick={() => setConfirm(true)}>{finishLabel}</button>
            </div>
          </section>
          <p className="text-xs text-ink-soft">After finishing a section, you cannot return to it.</p>
        </main>

        <aside className="hidden h-fit rounded-2xl border border-line bg-white p-5 lg:block">
          <h3 className="mb-3 font-display font-extrabold text-navy">Question navigator</h3>
          {navigator}
        </aside>
      </div>

      {/* Mobile/tablet: navigator lipat + bilah navigasi tetap di bawah */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white lg:hidden">
        {navOpen && <div className="max-h-[45vh] overflow-y-auto border-b border-line p-4">{navigator}<button className="btn-outline mt-3 w-full" onClick={() => { setNavOpen(false); setConfirm(true); }}>{finishLabel}</button></div>}
        <div className="flex items-center gap-2 p-3">
          <button className="btn-outline !px-4" disabled={cur === 0} onClick={() => setCur(cur - 1)} aria-label="Previous question">Previous</button>
          <button className="btn-outline flex-1" onClick={() => setNavOpen(!navOpen)} aria-expanded={navOpen}>{cur + 1}/{st.questions.length} · {answered} answered</button>
          {cur < st.questions.length - 1
            ? <button className="btn-solid !px-5" onClick={() => setCur(cur + 1)} aria-label="Next question">Next</button>
            : <button className="btn-accent !px-4" onClick={() => setConfirm(true)}>Done</button>}
        </div>
      </div>
      <div className="mx-auto hidden w-full max-w-6xl items-center justify-between px-6 pb-6 lg:flex">
        <button className="btn-outline" disabled={cur === 0} onClick={() => setCur(cur - 1)}>Previous</button>
        {cur < st.questions.length - 1 ? <button className="btn-solid" onClick={() => setCur(cur + 1)}>Next</button> : <button className="btn-accent" onClick={() => setConfirm(true)}>{finishLabel}</button>}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Confirm" className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <h3 className="font-display text-xl font-extrabold text-navy">{last ? "Submit the test?" : "Finish this section?"}</h3>
            <p className="mt-2 text-sm text-ink-soft">
              {st.questions.length - answered > 0 ? `${st.questions.length - answered} questions unanswered. ` : "All questions answered. "}
              {last ? "After submitting, your answers cannot be changed." : "You cannot return to this section."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setConfirm(false)} className="btn-outline">Back</button>
              <button disabled={busy} onClick={() => next()} className="btn-solid">{busy ? "Processing…" : "Yes, continue"}</button>
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
    try {
      const d = await api(base, { json: {} });
      const a = el.current!; a.src = d.url; a.currentTime = d.startAtSec || 0;
      await a.play(); setPhase("playing");
    } catch (e) {
      const status = (e as { status?: number }).status;
      setPhase(status === 403 ? "done" : "error");
      setMsg(e instanceof DOMException ? "The browser blocked playback. Click “Start audio” again." : (e as Error).message);
    }
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      const a = el.current; if (!a) return;
      lastPos.current = Math.max(lastPos.current, a.currentTime);
      api(base, { method: "PATCH", json: { posSec: lastPos.current } }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [phase, base]);

  return (
    <div className="card">
      <p className="text-sm font-semibold text-navy">{instruction ?? "Listen to the audio"}</p>
      <audio ref={el} preload="auto" controlsList="nodownload noplaybackrate"
        onEnded={() => { setPhase("done"); api(base, { method: "PATCH", json: { posSec: el.current?.duration ?? lastPos.current, done: true } }).catch(() => {}); }}
        onSeeking={() => { const a = el.current; if (a && a.currentTime > lastPos.current + 1) a.currentTime = lastPos.current; }}
        onError={() => { if (phase === "playing") { setPhase("error"); setMsg("Audio failed to load. Click “Reload audio”; this does not count as replaying."); } }} />
      {phase === "idle" && <button onClick={start} className="btn-solid mt-3">Start audio (once only)</button>}
      {phase === "playing" && <p className="mt-3 text-sm text-success" role="status">Audio is playing. It cannot be paused or replayed.</p>}
      {phase === "done" && <p className="mt-3 text-sm text-ink-soft">Audio has been played.</p>}
      {phase === "error" && <button onClick={start} className="btn-outline mt-3">Reload audio</button>}
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
    </div>
  );
}

/** Mode latihan: pemutar penuh (jeda, ulang, geser) dengan kecepatan 0.75×–1.25×. Tidak berlaku di placement/simulasi/kuis. */
function PracticeAudio({ attemptId, audioId, instruction }: { attemptId: string; audioId: string; instruction?: string }) {
  const el = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState("");
  const [rate, setRate] = useState(1);
  const [err, setErr] = useState("");
  useEffect(() => {
    api(`/api/attempts/${attemptId}/audio/${audioId}`, { json: {} }).then((d) => setSrc(d.url)).catch((e) => setErr((e as Error).message));
  }, [attemptId, audioId]);
  useEffect(() => { if (el.current) el.current.playbackRate = rate; }, [rate, src]);
  return (
    <div className="card">
      <p className="text-sm font-semibold text-navy">{instruction ?? "Listen to the audio"} <span className="font-normal text-ink-soft">(practice mode: replay allowed)</span></p>
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
      <audio ref={el} src={src || undefined} controls preload="auto" controlsList="nodownload" className="mt-3 w-full" />
      <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">Kecepatan
        <select aria-label="Kecepatan audio" className="field !min-h-[36px] w-auto" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{[0.75, 1, 1.25].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
      </label>
    </div>
  );
}

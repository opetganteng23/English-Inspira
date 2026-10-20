"use client";

import { enterFullscreen, isFullscreen, onFullscreenChange } from "@/lib/fullscreen";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { SecureZone } from "@/components/SecureZone";
import { GroupAudio } from "@/components/TestAudio";

type Q = { id: string; groupId: string | null; stem: string; options: string[]; assetIds?: string[] };
type G = { id: string; instruction?: string; passageTitle?: string; passageHtml?: string; audio: { id: string; finished: boolean } | null };
type State = {
  status: "in_progress" | "submitted"; testName: string;
  section: { index: number; total: number; name: string };
  kind?: string; secure?: boolean; reached?: number; idleTimeoutSec?: number; remainingSec: number; groups: G[]; questions: Q[]; answers: { qid: string; choice: number | null; flagged: boolean; timeSpentSec?: number }[];
};

const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & Written Expression", reading: "Reading" };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Ruang({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [st, setSt] = useState<State | null>(null);
  const [noticeSeen, setNoticeSeen] = useState<Set<string>>(new Set()); // pemberitahuan mode satu arah per bagian sudah ditutup
  const [ack, setAck] = useState(false); // centang "saya mengerti soal kosong dinilai salah" sebelum menutup bagian
  const advancing = useRef(false);
  const [err, setErr] = useState("");
  const [cur, setCur] = useState(0);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState<"ok" | "saving" | "fail">("ok");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const scrollArea = useRef<HTMLDivElement>(null);
  const passageBox = useRef<HTMLElement>(null);
  // Pindah nomor soal: area soal dan teks bacaan kembali ke paling atas (QA: posisi gulir tidak boleh tertinggal).
  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 });
    passageBox.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [cur]);

  const dirty = useRef<Set<string>>(new Set());
  const pendingFlags = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ansRef = useRef(ans); ansRef.current = ans;
  const flagRef = useRef(flagged); flagRef.current = flagged;
  // Waktu per soal: akumulasi detik saat soal tampil (dipakai analisis AI).
  const spent = useRef<Record<string, number>>({});
  const viewSince = useRef<{ qid: string; at: number } | null>(null);
  // Mode aman: nomor terjauh yang sudah dicapai; nomor sebelumnya terkunci (juga ditegakkan server).
  const reachedRef = useRef(0);
  const reachedDirty = useRef(false);

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
      reachedRef.current = d.secure ? d.reached ?? 0 : 0; reachedDirty.current = false;
      // Setelah refresh, kembali ke soal terakhir yang dibuka (disimpan per section di browser); bila tidak ada, ke soal pertama yang belum dijawab.
      const answered = new Set(d.answers.filter((x) => x.choice != null).map((x) => x.qid));
      let start = 0;
      if (d.secure) start = reachedRef.current;
      else {
        let saved = NaN;
        try { saved = Number(sessionStorage.getItem(`ei-pos:${params.id}:${d.section.index}`)); } catch { /* penyimpanan tidak tersedia */ }
        const firstOpen = d.questions.findIndex((x) => !answered.has(x.id));
        start = Number.isInteger(saved) && saved >= 0 && saved < d.questions.length ? saved : Math.max(0, firstOpen);
      }
      setSt(d); setCur(start); setLeft(d.remainingSec); setConfirm(false); spent.current = {};
      for (const a of d.answers) if (a.timeSpentSec) spent.current[a.qid] = a.timeSpentSec;
      setAns(Object.fromEntries(d.answers.filter((a) => a.choice != null).map((a) => [a.qid, a.choice as number])));
      setFlagged(Object.fromEntries(d.answers.map((a) => [a.qid, a.flagged])));
    } catch (e) { setErr((e as Error).message); }
  }, [params.id, router]);
  useEffect(() => { load(); }, [load]);

  // Simpan nomor soal yang sedang dibuka agar refresh tidak mengembalikan ke soal 1.
  useEffect(() => {
    if (!st || st.secure) return;
    try { sessionStorage.setItem(`ei-pos:${params.id}:${st.section.index}`, String(cur)); } catch { /* penyimpanan tidak tersedia */ }
  }, [st, cur, params.id]);

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
    if (!dirty.current.size && !pendingFlags.current.length && !reachedDirty.current) return true;
    const sendReached = reachedDirty.current; reachedDirty.current = false;
    const ids = Array.from(dirty.current); dirty.current.clear();
    const flags = pendingFlags.current.splice(0);
    setSaved("saving");
    try {
      await api(`/api/attempts/${params.id}`, {
        method: "PATCH",
        json: {
          answers: ids.map((qid) => ({ qid, choice: ansRef.current[qid] ?? null, flagged: !!flagRef.current[qid], timeSpentSec: Math.min(3600, Math.round(spent.current[qid] ?? 0)) })),
          flags,
          ...(sendReached ? { reached: reachedRef.current } : {}),
        },
      });
      setSaved("ok"); return true;
    } catch (e) {
      if ((e as { status?: number }).status === 409) { await load(); return false; } // section habis di server
      ids.forEach((i) => dirty.current.add(i)); flags.forEach((f) => pendingFlags.current.push(f)); if (sendReached) reachedDirty.current = true; setSaved("fail"); return false;
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
    const fs = () => !isFullscreen() && add("fullscreen_exit");
    const paste = () => add("paste");
    document.addEventListener("visibilitychange", vis); const offFs = onFullscreenChange(fs); document.addEventListener("paste", paste);
    return () => { document.removeEventListener("visibilitychange", vis); offFs(); document.removeEventListener("paste", paste); };
  }, [flush]);

  async function next(auto = false) {
    if (busy || advancing.current) return; // ref: klik ganda dalam satu render tidak lolos
    advancing.current = true; setBusy(true);
    const fromIdx = st?.section.index;
    await flush();
    try {
      const d = await api(`/api/attempts/${params.id}/advance`, { json: { fromIdx } });
      setBusy(false); advancing.current = false;
      if (d.status === "submitted") return router.replace(`/results/${params.id}`);
      await load();
    } catch (e) { setBusy(false); advancing.current = false; if (!auto) setErr((e as Error).message); else await load(); }
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
  const openConfirm = () => { setAck(false); setConfirm(true); };
  const secure = !!st.secure;
  const noticeKey = `ei-oneway:${params.id}:${st.section.index}`;
  const showNotice = secure && !noticeSeen.has(noticeKey) && (() => { try { return !sessionStorage.getItem(noticeKey); } catch { return true; } })();
  const closeNotice = () => { try { sessionStorage.setItem(noticeKey, "1"); } catch { /* */ } setNoticeSeen((x) => new Set(x).add(noticeKey)); };
  // Pindah soal. Mode aman: hanya maju; soal yang dilewati terkunci, jawaban yang tertunda disimpan sekarang.
  const goTo = (i: number) => {
    if (i < 0 || i >= st.questions.length) return;
    if (secure) {
      if (i < reachedRef.current) return;
      if (i > reachedRef.current) { reachedRef.current = i; reachedDirty.current = true; void flush(); }
    }
    setCur(i);
  };
  const firstOpen = st.questions.findIndex((x, i) => ans[x.id] == null && (!secure || i >= reachedRef.current));
  const unanswered = st.questions.length - answered;
  const lockedBlank = secure ? st.questions.filter((x, i) => ans[x.id] == null && i < reachedRef.current).length : 0; // dilewati, tidak bisa dijawab lagi
  const canAnswerMore = firstOpen >= 0;

  const navigator = (
    <>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6">
        {st.questions.map((x, i) => (
          <button key={x.id} disabled={secure && i !== cur} onClick={() => { goTo(i); setNavOpen(false); }} aria-label={`Question ${i + 1}${ans[x.id] != null ? ", answered" : ""}${flagged[x.id] ? ", flagged" : ""}`} aria-current={i === cur}
            className={`h-10 rounded-lg text-sm font-semibold ${i === cur ? "ring-2 ring-brand " : ""}${!secure && flagged[x.id] ? "bg-accent-tint text-accent-dark" : ans[x.id] != null ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>{i + 1}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-soft">{answered} of {st.questions.length} answered · blue = answered{secure ? " · secure mode: one way, use Next to move on" : ", orange = flagged"}</p>
    </>
  );

  return (
    <SecureZone active={secure}>
    <div className="relative flex h-dvh flex-col overflow-clip">
      <header className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-navy px-4 py-2.5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold sm:text-base">{st.testName}</p>
          <p className="truncate text-xs text-mist">Section {st.section.index + 1}/{st.section.total} · {LABEL[st.section.name]}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`hidden sm:inline ${saved === "fail" ? "text-orange-300" : "text-mist"}`}>{saved === "saving" ? "Saving…" : saved === "fail" ? "Save failed, retrying" : "Saved automatically"}</span>
          <span className={`rounded-lg px-3 py-1.5 font-display text-lg font-extrabold ${left < 60 ? "bg-accent" : "bg-navy-700"}`} role="timer" aria-label="Section time remaining">{mmss(left)}</span>
          <button className="hidden rounded-lg border border-white/40 px-3 py-1.5 text-xs md:block" onClick={() => enterFullscreen()}>Fullscreen</button>
        </div>
        {saved === "fail" && <p className="basis-full text-xs text-orange-300 sm:hidden">Save failed, retrying…</p>}
      </header>

      <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto grid w-full max-w-6xl gap-4 p-3 sm:p-5 lg:grid-cols-[1fr_280px] lg:items-start">
        <main className="flex min-w-0 flex-col gap-4">
          {group && <GroupAudio kind={st.kind} attemptId={params.id} group={group} />}
          {group?.passageHtml && (
            <article ref={passageBox} className="card max-h-[40dvh] overflow-y-auto lg:max-h-[60dvh]">
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
              {secure ? <span /> : <button onClick={toggleFlag} className="min-h-[44px] text-sm font-semibold text-accent-dark">{flagged[q.id] ? "★ Flagged" : "☆ Flag question"}</button>}
              {!secure && <button className="btn-outline hidden lg:inline-flex" onClick={() => openConfirm()}>{finishLabel}</button>}
            </div>
          </section>
          <p className="text-xs text-ink-soft">{secure ? "Secure mode: you cannot go back to previous questions. Answer each question before pressing Next." : "After finishing a section, you cannot return to it."}</p>
        </main>

        <aside className="sticky top-3 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-line bg-white p-4 lg:block">
          <h3 className="mb-3 font-display font-extrabold text-navy">Question navigator</h3>
          {navigator}
        </aside>
      </div></div>

      {/* Mobile/tablet: navigator lipat + bilah navigasi tetap di bawah */}
      <div className="z-20 shrink-0 border-t border-line bg-white lg:hidden">
        {navOpen && <div className="max-h-[45vh] overflow-y-auto border-b border-line p-4">{navigator}{(!secure || cur === st.questions.length - 1) && <button className="btn-outline mt-3 w-full" onClick={() => { setNavOpen(false); openConfirm(); }}>{finishLabel}</button>}</div>}
        <div className="flex items-center gap-2 p-3">
          {!secure && <button className="btn-outline !px-4" disabled={cur === 0} onClick={() => goTo(cur - 1)} aria-label="Previous question">Previous</button>}
          <button className="btn-outline flex-1" onClick={() => setNavOpen(!navOpen)} aria-expanded={navOpen}>{cur + 1}/{st.questions.length} · {answered} answered</button>
          {cur < st.questions.length - 1
            ? <button className="btn-solid !px-5" onClick={() => goTo(cur + 1)} aria-label="Next question">Next</button>
            : <button className="btn-accent !px-4" onClick={() => openConfirm()}>{finishLabel}</button>}
        </div>
      </div>
      <div className="mx-auto hidden w-full max-w-6xl shrink-0 items-center justify-between border-t border-line bg-white px-6 py-3 lg:flex">
        {secure ? <span className="text-sm text-ink-soft">Secure mode: no going back</span> : <button className="btn-outline" disabled={cur === 0} onClick={() => goTo(cur - 1)}>Previous</button>}
        {cur < st.questions.length - 1 ? <button className="btn-solid" onClick={() => goTo(cur + 1)}>Next</button> : <button className="btn-accent" onClick={() => openConfirm()}>{finishLabel}</button>}
      </div>

      {showNotice && !confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="One-way section" className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <p className="text-xs font-semibold tracking-wider text-brand">SECTION {st.section.index + 1} OF {st.section.total} · {(LABEL[st.section.name] ?? st.section.name).toUpperCase()}</p>
            <h3 className="mt-1 font-display text-xl font-extrabold text-navy">This section is one way</h3>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink">
              <li>You cannot go back to a previous question.</li>
              <li><b>Choose an answer before pressing Next.</b> A question you skip cannot be answered later and is scored as wrong.</li>
              <li>Press <b>Finish section</b> only on the last question, after answering it.</li>
              {st.section.name === "listening" && <li>Each audio plays <b>once</b>. Answer while or right after it plays.</li>}
            </ul>
            <button className="btn-solid mt-5 w-full" onClick={closeNotice}>I understand, start</button>
          </div>
        </div>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Confirm" className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <h3 className="font-display text-xl font-extrabold text-navy">{last ? "Submit the test?" : "Finish this section?"}</h3>
            <p className="mt-2 text-sm text-ink-soft">
              {unanswered > 0 ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered and will be scored as wrong. ` : "All questions answered. "}
              {secure && canAnswerMore ? "Choose Cancel to stay on the current question. " : ""}{secure && lockedBlank > 0 ? `${lockedBlank === unanswered ? (lockedBlank === 1 ? "It was" : "They were") : `${lockedBlank} of them ${lockedBlank === 1 ? "was" : "were"}`} skipped earlier and can no longer be answered (secure mode). ` : ""}
              {last ? "After submitting, your answers cannot be changed." : "You cannot return to this section."}
            </p>
            {st.questions.length - answered > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase text-ink-soft">Unanswered</p>
                <div className="mt-1.5 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {st.questions.map((x, i) => (ans[x.id] == null ? secure ? <span key={x.id} className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-accent bg-accent-tint px-2 text-sm font-semibold text-accent-dark">{i + 1}</span> : <button key={x.id} type="button" onClick={() => { goTo(i); setConfirm(false); setNavOpen(false); }} className="h-9 min-w-[36px] rounded-lg border border-accent bg-accent-tint px-2 text-sm font-semibold text-accent-dark disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Go to question ${i + 1}`}>{i + 1}</button> : null))}
                </div>
              </div>
            )}
            {unanswered > 0 && (
              <label className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I understand that {unanswered} unanswered question{unanswered === 1 ? "" : "s"} will be scored as wrong and I cannot come back to {last ? "the test" : "this section"}.</span>
              </label>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {unanswered > 0 && canAnswerMore && !secure ? (
                <>
                  <button disabled={busy || !ack} onClick={() => next()} className="btn-outline order-2 !border-red-300 !text-red-700 disabled:opacity-50 sm:order-1">{busy ? "Processing…" : last ? "Submit anyway" : "Finish section anyway"}</button>
                  <button onClick={() => { goTo(firstOpen); setConfirm(false); }} className="btn-solid order-1 sm:order-2">Go back and answer</button>
                </>
              ) : unanswered > 0 ? (
                <>
                  <button onClick={() => setConfirm(false)} className="btn-outline">Cancel</button>
                  <button disabled={busy || !ack} onClick={() => next()} className="btn-solid disabled:opacity-50">{busy ? "Processing…" : last ? "Submit test" : "Finish section"}</button>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirm(false)} className="btn-outline">{secure ? "Cancel" : "Back"}</button>
                  <button disabled={busy} onClick={() => next()} className="btn-solid">{busy ? "Processing…" : last ? "Submit test" : "Finish section"}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </SecureZone>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-dvh items-center justify-center p-6 text-ink-soft">{children}</div>;

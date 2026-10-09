"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, tgl } from "@/lib/client";

type Access = { allowed: boolean; used: number; quota: number; remaining: number; resetsAt: string; reason: string | null };
type Msg = { role: "user" | "assistant"; content: string; at?: string };
type Plan = { id: string; text: string; done: boolean; dueAt: string | null };
type Thread = { id: string; title: string; messages: Msg[]; actionPlan: Plan[]; helpful: boolean | null; basis: { kind: string; scoreEst: number; sections: { section: string; scaled: number }[]; finishedAt: string; attemptId: string } | null; access: Access };
type Item = { id: string; title: string; last: string; open: number };
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const SUGGEST = ["Apa yang harus saya lakukan supaya capai target?", "Kenapa skor Structure saya rendah?", "Kapan saya siap daftar ITP resmi?", "Buatkan rencana belajar untuk 30 menit sehari"];

function Chat() {
  const router = useRouter();
  const want = useSearchParams().get("thread");
  const [list, setList] = useState<Item[]>([]);
  const [access, setAccess] = useState<Access | null>(null);
  const [t, setT] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"chat" | "side">("chat");
  const [ready, setReady] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const open = useCallback(async (id: string) => {
    try { const d: Thread = await api(`/api/counselor/threads/${id}`); setT(d); setAccess(d.access); setErr(""); } catch (e) { setErr((e as Error).message); }
  }, []);
  const loadList = useCallback(async () => { const d = await api("/api/counselor/threads"); setList(d.threads); setAccess(d.access); return d.threads as Item[]; }, []);

  useEffect(() => {
    (async () => {
      try {
        const items = await loadList();
        const id = want ?? items[0]?.id;
        if (id) await open(id);
      } catch (e) { setErr((e as Error).message); } finally { setReady(true); }
    })();
  }, [want, loadList, open]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [t?.messages.length, sending]);

  async function newThread() {
    try { const d = await api("/api/counselor/threads", { json: {} }); await loadList(); router.replace(`/konselor?thread=${d.id}`); setTab("chat"); } catch (e) { setErr((e as Error).message); }
  }
  async function send(content: string) {
    if (!content.trim() || sending) return;
    let th = t;
    try {
      if (!th) { const d = await api("/api/counselor/threads", { json: {} }); await open(d.id); th = { id: d.id } as Thread; router.replace(`/konselor?thread=${d.id}`); }
      setSending(true); setErr(""); setText("");
      setT((x) => (x ? { ...x, messages: [...x.messages, { role: "user", content }] } : x));
      const r = await api(`/api/counselor/threads/${th.id}/messages`, { json: { content } });
      setT((x) => x && { ...x, messages: [...x.messages, { role: "assistant", content: r.reply }], actionPlan: r.actionPlan ?? x.actionPlan, access: r.access });
      setAccess(r.access); loadList();
    } catch (e) {
      setErr((e as Error).message);
      setText(content);
      setT((x) => x && { ...x, messages: x.messages.slice(0, -1) }); // batalkan pesan optimistik
      if ((e as { status?: number }).status === 402) loadList();
    } finally { setSending(false); }
  }
  async function toggle(id: string, done: boolean) {
    setT((x) => x && { ...x, actionPlan: x.actionPlan.map((p) => (p.id === id ? { ...p, done } : p)) });
    try { await api(`/api/counselor/plan/${id}`, { method: "PATCH", json: { done } }); } catch (e) { setErr((e as Error).message); open(t!.id); }
  }
  async function rate(helpful: boolean) {
    if (!t) return;
    setT({ ...t, helpful });
    try { await api(`/api/counselor/threads/${t.id}`, { method: "PATCH", json: { helpful } }); } catch { /* abaikan */ }
  }

  if (!ready) return <p className="py-6 text-ink-soft" role="status">Memuat…</p>;
  const blocked = access && !access.allowed;

  const side = (
    <div className="flex flex-col gap-4">
      {t?.basis && (
        <section className="card !p-4">
          <h2 className="text-xs font-semibold tracking-wider text-ink-soft">DASAR PERCAKAPAN</h2>
          <p className="mt-1 font-display text-3xl font-extrabold text-navy">{t.basis.scoreEst}</p>
          <p className="text-xs text-ink-soft">{t.basis.kind === "placement" ? "Placement" : t.basis.kind === "sim" ? "Simulasi" : "Tes"} · {tgl(t.basis.finishedAt)}</p>
          <ul className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">{t.basis.sections.map((s) => <li key={s.section} className="rounded-lg bg-canvas p-2"><span className="text-ink-soft">{SEC[s.section]}</span><br /><b className="text-navy">{s.scaled}</b></li>)}</ul>
          <Link href={`/hasil/${t.basis.attemptId}`} className="mt-3 inline-block text-sm font-semibold text-brand">Lihat laporan lengkap →</Link>
        </section>
      )}
      <section className="card !p-4">
        <h2 className="text-xs font-semibold tracking-wider text-ink-soft">RENCANA AKSI DARI KONSELING</h2>
        {t?.actionPlan.length ? (
          <ul className="mt-2 flex flex-col">{t.actionPlan.map((p) => <li key={p.id}><label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={p.done} onChange={(e) => toggle(p.id, e.target.checked)} /><span className={`text-sm ${p.done ? "text-ink-soft line-through" : ""}`}>{p.text}{p.dueAt && !p.done && <span className="block text-xs text-ink-soft">target {tgl(p.dueAt)}</span>}</span></label></li>)}</ul>
        ) : <p className="mt-2 text-sm text-ink-soft">Minta Konselor menyusun rencana, dan butirnya muncul di sini.</p>}
        <p className="mt-2 text-xs text-ink-soft">Pengingat dikirim lewat email setiap Senin.</p>
      </section>
      <section className="card !p-4 text-sm">
        <h2 className="text-xs font-semibold tracking-wider text-ink-soft">AKSES KONSELOR AI</h2>
        {access && <p className="mt-1">Pesan bulan ini: <b>{access.used}</b> dari {access.quota} terpakai. {access.allowed ? `Sisa ${access.remaining}, direset ${tgl(access.resetsAt)}.` : access.reason}</p>}
      </section>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="page-title">Konselor AI</h1><p className="text-sm text-ink-soft">Membaca semua hasil tesmu{t?.basis ? ` · terakhir ${t.basis.kind === "placement" ? "placement" : "tes"}` : ""}</p></div>
        <button className="btn-outline" onClick={newThread}>+ Percakapan baru</button>
      </div>

      <div className="flex gap-1 rounded-lg bg-white p-1 text-sm lg:hidden" role="tablist">
        {([["chat", "Percakapan"], ["side", "Rencana & info"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-3 py-2 font-semibold ${tab === k ? "bg-navy text-white" : "text-ink-soft"}`}>{l}</button>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_300px]">
        <nav aria-label="Daftar percakapan" className="hidden flex-col gap-1 lg:flex">
          {list.map((i) => <button key={i.id} onClick={() => router.replace(`/konselor?thread=${i.id}`)} className={`rounded-xl border p-3 text-left text-sm ${t?.id === i.id ? "border-brand bg-brand-tint" : "border-line bg-white hover:border-brand"}`}><b className="block truncate text-navy">{i.title}</b><span className="block truncate text-xs text-ink-soft">{i.last || "Belum ada pesan"}</span></button>)}
          {list.length === 0 && <p className="text-sm text-ink-soft">Belum ada percakapan.</p>}
        </nav>

        <section className={`${tab === "chat" ? "flex" : "hidden"} min-h-[60vh] flex-col rounded-2xl border border-line bg-white lg:flex`}>
          {list.length > 1 && <select aria-label="Pilih percakapan" className="field m-3 !h-10 lg:hidden" value={t?.id ?? ""} onChange={(e) => router.replace(`/konselor?thread=${e.target.value}`)}>{list.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>}
          <div className="flex max-h-[62vh] flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            {(!t || t.messages.length === 0) && (
              <div className="m-auto max-w-md text-center">
                <p className="font-semibold text-navy">Tanya apa saja tentang hasil dan persiapan tesmu.</p>
                <div className="mt-3 flex flex-col gap-2">{SUGGEST.map((s) => <button key={s} disabled={!!blocked} onClick={() => send(s)} className="rounded-xl border border-line-strong px-3 py-2.5 text-left text-sm hover:border-brand disabled:opacity-50">{s}</button>)}</div>
              </div>
            )}
            {t?.messages.map((m, i) => (
              <div key={i} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[80%] ${m.role === "user" ? "self-end bg-brand text-white" : "self-start border border-line bg-canvas text-ink"}`}>
                {m.role === "assistant" && <b className="mb-1 block text-xs text-brand">AI</b>}{m.content}
              </div>
            ))}
            {sending && <div className="self-start rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink-soft" role="status">Mengetik…</div>}
            <div ref={bottom} />
          </div>
          {t && t.messages.length > 1 && t.helpful == null && <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-xs text-ink-soft">Jawaban membantu? <button className="rounded-md border border-line px-2 py-1" onClick={() => rate(true)}>👍 Ya</button><button className="rounded-md border border-line px-2 py-1" onClick={() => rate(false)}>👎 Belum</button></div>}
          {err && <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
          {blocked ? (
            <div className="border-t border-line p-4 text-sm"><p className="text-ink-soft">{access?.reason}</p></div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t border-line p-3">
              <label className="sr-only" htmlFor="msg">Tulis pertanyaan</label>
              <textarea id="msg" rows={1} maxLength={1500} className="field max-h-32 min-h-[48px] flex-1 resize-none" placeholder="Tulis pertanyaan…" value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              <button className="btn-solid shrink-0" disabled={sending || !text.trim()}>Kirim</button>
            </form>
          )}
          <p className="px-4 pb-3 text-[11px] leading-snug text-ink-soft">Konselor AI bisa keliru. Cek ulang syarat resmi beasiswa atau instansimu sebelum mengambil keputusan penting.</p>
        </section>

        <aside className={`${tab === "side" ? "block" : "hidden"} lg:block`}>{side}</aside>
      </div>
    </div>
  );
}

export default function Konselor() {
  return <Suspense><Chat /></Suspense>;
}

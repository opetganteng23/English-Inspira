"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { PRESETS } from "@/lib/material-presets";
import { MaterialFrame } from "@/components/MaterialFrame";
import { useMaterialBase } from "@/lib/use-material-base";
import { Loading, ErrorNote } from "@/components/Charts";
import type { HtmlDoc } from "@/lib/material-doc";

// Editor berat dimuat hanya di klien.
const RichEditor = dynamic(() => import("@/components/RichEditor").then((m) => m.RichEditor), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-canvas" /> });
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-canvas" /> });

type Mat = { _id: string; title: string; summary?: string; kind: "rich" | "html"; contentJson?: unknown; contentHtml?: string; htmlDoc?: HtmlDoc; tags: string[]; access: "free" | "paid"; status: "draft" | "review" | "published"; version: number; slug: string; reviewNote?: string };
type Audio = { id: string; title: string; durationSec: number };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function MateriEditor({ params }: { params: { id: string } }) {
  const isNew = params.id === "baru";
  const { base, isAdmin } = useMaterialBase();
  const router = useRouter();
  const { data: loaded, error, loading } = useApi<Mat>(isNew ? null : `/api/admin/materials/${params.id}`);
  const audios = useApi<{ audio: Audio[] }>("/api/admin/audio");
  const versions = useApi<{ versions: { version: number; at: string }[] }>(isNew ? null : `/api/admin/materials/${params.id}/publish`);

  const [f, setF] = useState({ title: "", summary: "", kind: "rich" as "rich" | "html", access: "paid" as "free" | "paid", tags: "" });
  const [rich, setRich] = useState<{ json: unknown; html: string }>({ json: null, html: "" });
  const [doc, setDoc] = useState<HtmlDoc>({ html: "", css: "", js: "" });
  const [tab, setTab] = useState<"html" | "css" | "js" | "preview">("html");
  const [phone, setPhone] = useState(false);
  const [ready, setReady] = useState(isNew);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!loaded) return;
    setF({ title: loaded.title, summary: loaded.summary ?? "", kind: loaded.kind, access: loaded.access, tags: loaded.tags.join(", ") });
    setRich({ json: loaded.contentJson ?? null, html: loaded.contentHtml ?? "" });
    setDoc({ html: loaded.htmlDoc?.html ?? "", css: loaded.htmlDoc?.css ?? "", js: loaded.htmlDoc?.js ?? "" });
    setReady(true);
  }, [loaded]);
  // Ekstensi bahasa CodeMirror dimuat lazy.
  useEffect(() => { (async () => { const [h, c, j] = await Promise.all([import("@codemirror/lang-html"), import("@codemirror/lang-css"), import("@codemirror/lang-javascript")]); setLang({ html: h.html(), css: c.css(), js: j.javascript() }); })(); }, []);

  const body = () => ({
    title: f.title, summary: f.summary || undefined, kind: f.kind, access: f.access, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    ...(f.kind === "rich" ? { contentJson: rich.json, contentHtml: rich.html } : { htmlDoc: doc }),
  });
  async function save(publish = false, review = false) {
    setBusy(true); setMsg(null);
    try {
      let id = params.id;
      if (isNew) { const d = await api("/api/admin/materials", { json: body() }); id = d.id; }
      else await api(`/api/admin/materials/${id}`, { method: "PATCH", json: body() });
      let text = "Draf disimpan.";
      if (!isNew && loaded?.status === "review" && publish) { await api(`/api/admin/materials/${id}/publish`, { json: { action: "publish" } }); text = "Disetujui dan diterbitkan (versi baru)."; }
      else if (review) { await api(`/api/admin/materials/${id}/publish`, { json: { action: "submit_review" } }); text = "Diajukan untuk review. Materi HTML baru tayang setelah disetujui penyunting lain."; }
      else if (publish) { await api(`/api/admin/materials/${id}/publish`, { json: { action: "publish" } }); text = "Disimpan dan diterbitkan (versi baru)."; }
      setMsg({ ok: true, text });
      if (isNew) router.replace(`${base}/${id}`); else versions.reload();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function rollback(v: number) {
    if (!confirm(`Kembalikan materi ke versi ${v}? Ini membuat versi baru.`)) return;
    try { await api(`/api/admin/materials/${params.id}/publish`, { json: { action: "rollback", version: v } }); location.reload(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  function applyPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    if ((doc.html || doc.js) && !confirm("Template akan menimpa kode HTML/CSS/JS saat ini. Lanjutkan?")) return;
    setDoc(p.doc); setF((x) => ({ ...x, kind: "html", title: x.title || p.name }));
  }

  if (!isNew && loading) return <Loading />;
  if (!isNew && !loaded) return <ErrorNote text={error} />;
  const sizeKb = Math.round(((doc.html?.length ?? 0) + (doc.css?.length ?? 0) + (doc.js?.length ?? 0)) / 1024);

  return (
    <div className="flex flex-col gap-5">
      <Link href={base} className="text-sm font-semibold text-brand">← Semua materi</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{isNew ? "Materi baru" : "Edit materi"}</h1>
        <div className="flex flex-col gap-2 sm:flex-row"><button className="btn-outline" disabled={busy || !f.title.trim()} onClick={() => save(false)}>Simpan draf</button>{f.kind === "html" && loaded?.status !== "review" && !isNew && <button className="btn-solid" disabled={busy || !f.title.trim()} onClick={() => save(false, true)}>Simpan & ajukan review</button>}{f.kind === "html" && loaded?.status === "review" && <button className="btn-solid" disabled={busy} onClick={() => save(true)}>Setujui & terbitkan</button>}{f.kind === "rich" && <button className="btn-solid" disabled={busy || !f.title.trim()} onClick={() => save(true)}>Simpan & terbitkan</button>}</div>
      </div>
      {!isNew && loaded && <p className="text-sm text-ink-soft">Status: <b className="text-navy">{loaded.status === "published" ? "Terbit" : loaded.status === "review" ? "Menunggu review" : "Draf"}</b>{loaded.reviewNote && loaded.status === "draft" ? ` · catatan penolakan: ${loaded.reviewNote}` : ""}{f.kind === "html" ? ". Materi HTML wajib ditinjau dan disetujui sebelum tampil; mengubah isi HTML yang sudah terbit mengembalikannya ke draf." : ""}</p>}
      {isNew && f.kind === "html" && <p className="text-sm text-ink-soft">Simpan draf dulu, lalu ajukan review.</p>}
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <section className="card grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>Judul<input className="field font-normal" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className={`${label} sm:col-span-2`}>Ringkasan (tampil di daftar materi)<input className="field font-normal" maxLength={400} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
        <label className={label}>Jenis materi<select className="field font-normal" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "rich" | "html" })} disabled={!isNew && !!loaded && loaded.status === "published" && false}><option value="rich">Rich text (bacaan)</option>{isAdmin && <option value="html">HTML halaman penuh (interaktif)</option>}</select></label>
        <label className={`${label} sm:col-span-2`}>Tag (pisah koma)<input className="field font-normal" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="structure, grammar" /></label>
      </section>

      {ready && f.kind === "rich" && (
        <section className="card"><h2 className="mb-3 font-display text-lg font-extrabold text-navy">Isi materi</h2>
          <p className="mb-3 text-xs text-ink-soft">Gambar yang ditempel/diunggah otomatis dikompres dan disimpan sebagai aset; isi disanitasi di server saat disimpan dan saat ditampilkan.</p>
          <RichEditor initial={rich.json} audios={audios.data?.audio ?? []} onChange={(json, html) => setRich({ json, html })} /></section>
      )}

      {ready && f.kind === "html" && (
        <section className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-display text-lg font-extrabold text-navy">Dokumen HTML interaktif</h2><p className="text-xs text-ink-soft">Dijalankan di iframe sandbox: tidak bisa membaca cookie atau memanggil API. Laporkan skor dengan <code>EI.progress(skor0sampai100, jawaban)</code>. Audio: tulis <code>&lt;audio controls src=&quot;ei-audio:ID&quot;&gt;</code>. Ukuran {sizeKb} KB dari maks 2048 KB.</p></div>
            <label className="text-sm font-semibold text-navy">Mulai dari template<select className="field mt-1 font-normal" value="" onChange={(e) => { applyPreset(e.target.value); e.target.value = ""; }}><option value="">Pilih template…</option>{PRESETS.map((p) => <option key={p.key} value={p.key}>{p.name}: {p.desc}</option>)}</select></label>
          </div>
          {!!audios.data?.audio.length && <p className="text-xs text-ink-soft">ID audio: {audios.data.audio.map((a) => `${a.title} = ${a.id}`).join(" · ")}</p>}
          <div className="flex flex-wrap gap-1 rounded-lg bg-canvas p-1 text-sm" role="tablist">{([["html", "HTML"], ["css", "CSS"], ["js", "JavaScript"], ["preview", "Pratinjau langsung"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md px-3 py-2 font-semibold ${tab === k ? "bg-navy text-white" : "text-ink-soft"}`}>{l}</button>)}</div>
          {tab !== "preview" ? (
            <div className="overflow-hidden rounded-xl border border-line-strong text-sm"><CodeMirror value={doc[tab] ?? ""} height="380px" extensions={lang[tab] ? [lang[tab] as never] : []} onChange={(v) => setDoc((d) => ({ ...d, [tab]: v }))} basicSetup={{ lineNumbers: true, foldGutter: false }} /></div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={phone} onChange={(e) => setPhone(e.target.checked)} />Uji di layar ponsel (lebar 375 px)</label>
              <div className={`mx-auto w-full overflow-x-auto rounded-xl border border-line bg-canvas p-2 ${phone ? "max-w-[391px]" : ""}`}><MaterialFrame doc={doc} onProgress={(s) => setMsg({ ok: true, text: `Pratinjau: materi melaporkan skor ${Math.round(s)}.` })} /></div>
            </div>
          )}
        </section>
      )}

      {!isNew && versions.data && versions.data.versions.length > 0 && (
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Riwayat versi</h2>
          <ul className="mt-2 divide-y divide-line text-sm">{versions.data.versions.map((v) => <li key={v.version} className="flex items-center justify-between gap-3 py-2"><span>Versi {v.version} · {tgl(v.at, true)}</span><button className="font-semibold text-brand" onClick={() => rollback(v.version)}>Kembalikan</button></li>)}</ul></section>
      )}
    </div>
  );
}

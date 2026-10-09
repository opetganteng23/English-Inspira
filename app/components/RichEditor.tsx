"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import CharacterCount from "@tiptap/extension-character-count";
import { uploadImage } from "@/lib/compress-image";
import { BLOCK_TYPES, SCORED, TOPIC_RE, blockSchemas, blockSummary, type BlockType } from "@/lib/blocks";
import { RichViewer } from "./RichViewer";

/** Blok pemutar audio: hanya menyimpan id audio (+ opsi transkrip); URL bertanda tangan disisipkan server saat materi ditampilkan. */
const AudioBlock = Node.create({
  name: "audioBlock", group: "block", atom: true, draggable: true,
  addAttributes() {
    return {
      audioId: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-audio-id"), renderHTML: (a: { audioId?: string }) => ({ "data-audio-id": a.audioId }) },
      transcript: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute("data-transcript") === "1", renderHTML: (a: { transcript?: boolean }) => (a.transcript ? { "data-transcript": "1" } : {}) },
    };
  },
  parseHTML() { return [{ tag: "audio[data-audio-id]" }]; },
  renderHTML({ HTMLAttributes }) { return ["audio", mergeAttributes(HTMLAttributes, { controls: "controls" })]; },
});

/** Blok interaktif (kuis, flashcard, isian, pencocokan, timer, catatan/tips). Konfigurasi JSON divalidasi saat disisipkan dan lagi di server. */
const InteractiveNode = Node.create({
  name: "interactiveBlock", group: "block", atom: true, draggable: true,
  addAttributes() {
    const attr = (name: string, key: string) => ({ default: "", parseHTML: (el: HTMLElement) => el.getAttribute(name) ?? "", renderHTML: (a: Record<string, string>) => (a[key] ? { [name]: a[key] } : {}) });
    return { type: attr("data-ei-block", "type"), config: attr("data-config", "config"), topic: attr("data-topic", "topic"), bid: attr("data-bid", "bid") };
  },
  parseHTML() { return [{ tag: "div[data-ei-block]" }]; },
  renderHTML({ node, HTMLAttributes }) {
    let label = "Blok interaktif";
    try { label = blockSummary(node.attrs.type as BlockType, JSON.parse(node.attrs.config)) ?? label; } catch { /* tampilkan label bawaan */ }
    return ["div", mergeAttributes(HTMLAttributes, { style: "border:1.5px dashed #1B5FB8;border-radius:10px;padding:10px;background:#E9F0FA" }), `🧩 ${label}${node.attrs.topic ? ` · topik ${node.attrs.topic}` : ""}`];
  },
});

type AudioItem = { id: string; title: string; durationSec: number };
const FONTS = [["", "Font bawaan"], ["Georgia, serif", "Serif"], ["Arial, sans-serif", "Sans-serif"], ["'Courier New', monospace", "Monospace"]] as const;
const SIZES = ["", "14px", "16px", "18px", "20px", "24px", "32px"];

export function RichEditor({ initial, onChange, audios }: { initial?: unknown; onChange: (json: unknown, html: string) => void; audios: AudioItem[] }) {
  const [err, setErr] = useState("");
  const [full, setFull] = useState(false);
  const [phone, setPhone] = useState(false);
  const [html, setHtml] = useState("");
  const [blockDlg, setBlockDlg] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }), Image, TextAlign.configure({ types: ["heading", "paragraph"] }), Highlight, TextStyle, Color, FontFamily, FontSize, Subscript, Superscript,
      TaskList, TaskItem.configure({ nested: true }), Table.configure({ resizable: false }), TableRow, TableCell, TableHeader, Youtube.configure({ width: 560, height: 315, nocookie: true }), CharacterCount, AudioBlock, InteractiveNode,
    ],
    content: (initial as object) || "",
    editorProps: { attributes: { class: "prose-ei min-h-[280px] rounded-b-xl border border-line-strong bg-white p-4 outline-none focus:border-brand", "aria-label": "Isi materi" } },
    onUpdate: ({ editor: e }) => { setHtml(e.getHTML()); onChange(e.getJSON(), e.getHTML()); },
  });
  useEffect(() => { if (editor) { setHtml(editor.getHTML()); onChange(editor.getJSON(), editor.getHTML()); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [editor]);
  useEffect(() => { document.body.style.overflow = full ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [full]);
  if (!editor) return <div className="h-72 animate-pulse rounded-xl bg-canvas" />;

  async function addImage(f?: File) {
    if (!f) return; setErr("");
    try { const a = await uploadImage(f); editor!.chain().focus().setImage({ src: a.url, alt: f.name.replace(/\.\w+$/, "") }).run(); } // gambar → assets; HTML hanya menyimpan /api/assets/ID
    catch (e) { setErr((e as Error).message); }
  }
  async function addPdf(f?: File) {
    if (!f) return; setErr("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/material-files", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Gagal mengunggah PDF");
      editor!.chain().focus().insertContent(`<p><a href="${d.url}">📎 ${String(d.filename).replace(/[<>&"]/g, "")}</a></p>`).run();
    } catch (e) { setErr((e as Error).message); }
  }
  function addLink() {
    const url = window.prompt("Alamat tautan (https://…)");
    if (url === null) return;
    if (url === "") editor!.chain().focus().unsetLink().run(); else editor!.chain().focus().setLink({ href: url }).run();
  }
  function addYoutube() { const url = window.prompt("URL video YouTube"); if (url) editor!.commands.setYoutubeVideo({ src: url }); }
  function addAudio(id: string) {
    if (!id) return;
    const transcript = window.confirm("Tampilkan transkrip audio ini di bawah pemutar?\n(OK = tampilkan, Batal = tanpa transkrip)");
    editor!.chain().focus().insertContent({ type: "audioBlock", attrs: { audioId: id, transcript } }).run();
  }

  return (
    <div className={full ? "fixed inset-0 z-50 overflow-y-auto bg-white p-3 sm:p-6" : ""}>
      <Toolbar editor={editor} onImage={() => file.current?.click()} onPdf={() => pdf.current?.click()} onLink={addLink} onYoutube={addYoutube} onAudio={addAudio} onBlock={() => setBlockDlg(true)} audios={audios}
        full={full} onFull={() => setFull(!full)} phone={phone} onPhone={() => setPhone(!phone)} />
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={pdf} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { addPdf(e.target.files?.[0]); e.target.value = ""; }} />
      {err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}
      <EditorContent editor={editor} />
      <p className="mt-1 text-right text-xs text-ink-soft">{editor.storage.characterCount.words()} kata</p>
      {phone && (
        <div className="mx-auto mt-3 w-full max-w-[391px] rounded-[28px] border-[6px] border-navy bg-white p-3" aria-label="Pratinjau tampilan ponsel">
          <p className="mb-2 text-center text-[11px] text-ink-soft">Pratinjau ponsel (blok interaktif aktif, hasil tidak disimpan)</p>
          <RichViewer html={html} />
        </div>
      )}
      {blockDlg && <BlockDialog onClose={() => setBlockDlg(false)} onInsert={(attrs) => { editor.chain().focus().insertContent({ type: "interactiveBlock", attrs }).run(); setBlockDlg(false); }} />}
    </div>
  );
}

function Toolbar({ editor: e, onImage, onPdf, onLink, onYoutube, onAudio, onBlock, audios, full, onFull, phone, onPhone }: {
  editor: Editor; onImage: () => void; onPdf: () => void; onLink: () => void; onYoutube: () => void; onAudio: (id: string) => void; onBlock: () => void; audios: AudioItem[];
  full: boolean; onFull: () => void; phone: boolean; onPhone: () => void;
}) {
  const B = ({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) => (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={on} className={`flex h-9 min-w-[36px] items-center justify-center rounded-md px-2 text-sm font-semibold ${active ? "bg-navy text-white" : "text-navy hover:bg-brand-tint"}`}>{children}</button>
  );
  const sep = <span className="mx-1 h-6 w-px bg-line-strong" />;
  const sel = "h-9 rounded-md border border-line-strong bg-white px-2 text-sm";
  const inTable = e.isActive("table");
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-line-strong bg-canvas p-2" role="toolbar" aria-label="Format teks">
      <select aria-label="Gaya paragraf" className={sel} value={e.isActive("heading", { level: 2 }) ? "2" : e.isActive("heading", { level: 3 }) ? "3" : "p"} onChange={(ev) => { const v = ev.target.value; if (v === "p") e.chain().focus().setParagraph().run(); else e.chain().focus().toggleHeading({ level: Number(v) as 2 | 3 }).run(); }}><option value="p">Paragraf</option><option value="2">Judul</option><option value="3">Subjudul</option></select>
      <select aria-label="Jenis font" className={sel} value={(e.getAttributes("textStyle").fontFamily as string) ?? ""} onChange={(ev) => (ev.target.value ? e.chain().focus().setFontFamily(ev.target.value).run() : e.chain().focus().unsetFontFamily().run())}>{FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select>
      <select aria-label="Ukuran font" className={sel} value={(e.getAttributes("textStyle").fontSize as string) ?? ""} onChange={(ev) => (ev.target.value ? e.chain().focus().setFontSize(ev.target.value).run() : e.chain().focus().unsetFontSize().run())}>{SIZES.map((s) => <option key={s} value={s}>{s || "Ukuran"}</option>)}</select>
      <B label="Tebal" active={e.isActive("bold")} on={() => e.chain().focus().toggleBold().run()}><b>B</b></B>
      <B label="Miring" active={e.isActive("italic")} on={() => e.chain().focus().toggleItalic().run()}><i>I</i></B>
      <B label="Garis bawah" active={e.isActive("underline")} on={() => e.chain().focus().toggleUnderline().run()}><u>U</u></B>
      <B label="Coret" active={e.isActive("strike")} on={() => e.chain().focus().toggleStrike().run()}><s>S</s></B>
      <B label="Highlight" active={e.isActive("highlight")} on={() => e.chain().focus().toggleHighlight().run()}>▮</B>
      <input aria-label="Warna teks" type="color" className="h-9 w-9 cursor-pointer rounded-md border border-line-strong bg-white p-1" onChange={(ev) => e.chain().focus().setColor(ev.target.value).run()} />
      <B label="Subskrip" active={e.isActive("subscript")} on={() => e.chain().focus().toggleSubscript().run()}>x₂</B>
      <B label="Superskrip" active={e.isActive("superscript")} on={() => e.chain().focus().toggleSuperscript().run()}>x²</B>
      {sep}
      <B label="Daftar poin" active={e.isActive("bulletList")} on={() => e.chain().focus().toggleBulletList().run()}>•≡</B>
      <B label="Daftar nomor" active={e.isActive("orderedList")} on={() => e.chain().focus().toggleOrderedList().run()}>1.</B>
      <B label="Checklist" active={e.isActive("taskList")} on={() => e.chain().focus().toggleTaskList().run()}>☑</B>
      <B label="Kutipan" active={e.isActive("blockquote")} on={() => e.chain().focus().toggleBlockquote().run()}>“</B>
      <B label="Blok kode" active={e.isActive("codeBlock")} on={() => e.chain().focus().toggleCodeBlock().run()}>{"</>"}</B>
      <B label="Garis pemisah" on={() => e.chain().focus().setHorizontalRule().run()}>―</B>
      {sep}
      {(["left", "center", "right", "justify"] as const).map((a) => <B key={a} label={`Rata ${a}`} active={e.isActive({ textAlign: a })} on={() => e.chain().focus().setTextAlign(a).run()}>{a === "left" ? "⇤" : a === "center" ? "↔" : a === "right" ? "⇥" : "☰"}</B>)}
      {sep}
      <B label="Tautan" active={e.isActive("link")} on={onLink}>🔗</B>
      <B label="Sisipkan gambar" on={onImage}>🖼</B>
      <B label="Sisipkan video YouTube" on={onYoutube}>▶</B>
      <B label="Lampirkan PDF" on={onPdf}>📎</B>
      <B label="Sisipkan tabel" on={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</B>
      <select aria-label="Sisipkan audio" className={`${sel} max-w-[160px]`} value="" onChange={(ev) => onAudio(ev.target.value)}><option value="">🔊 Sisipkan audio</option>{audios.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.durationSec}s)</option>)}</select>
      <button type="button" onClick={onBlock} className="h-9 rounded-md bg-brand px-3 text-sm font-semibold text-white">🧩 Blok interaktif</button>
      {inTable && (
        <>
          {sep}
          <B label="Tambah kolom" on={() => e.chain().focus().addColumnAfter().run()}>+kol</B>
          <B label="Tambah baris" on={() => e.chain().focus().addRowAfter().run()}>+bar</B>
          <B label="Hapus kolom" on={() => e.chain().focus().deleteColumn().run()}>−kol</B>
          <B label="Hapus baris" on={() => e.chain().focus().deleteRow().run()}>−bar</B>
          <B label="Gabung sel" on={() => e.chain().focus().mergeCells().run()}>⊞</B>
          <B label="Pisah sel" on={() => e.chain().focus().splitCell().run()}>⊟</B>
          <B label="Hapus tabel" on={() => e.chain().focus().deleteTable().run()}>🗑</B>
        </>
      )}
      {sep}
      <B label="Urungkan" on={() => e.chain().focus().undo().run()}>↶</B>
      <B label="Ulangi" on={() => e.chain().focus().redo().run()}>↷</B>
      {sep}
      <B label="Pratinjau ponsel" active={phone} on={onPhone}>📱</B>
      <B label={full ? "Keluar layar penuh" : "Layar penuh"} active={full} on={onFull}>⛶</B>
    </div>
  );
}

// ---------- Dialog blok interaktif ----------
const LABEL: Record<BlockType, string> = { quiz: "Kuis pilihan ganda", flashcard: "Flashcard", fill: "Isian (fill-in-the-blank)", match: "Pencocokan (drag/pilih pasangan)", timer: "Timer latihan", note: "Catatan / tips" };
const HELP: Record<BlockType, string> = {
  quiz: "Satu soal per paragraf (pisahkan dengan baris kosong). Baris pertama = pertanyaan, baris berikutnya = pilihan; awali pilihan yang benar dengan *.\nContoh:\nThe results ___ clear.\nis\n*are",
  flashcard: "Satu kartu per baris: depan | belakang",
  fill: "Satu kalimat per baris: kalimat dengan ___ => jawaban. Beberapa isian dipisah titik koma; alternatif jawaban dengan /.\nContoh: She ___ to school. => goes",
  match: "Satu pasangan per baris: kiri | kanan",
  timer: "", note: "",
};

function buildConfig(type: BlockType, text: string, extra: { minutes: number; prompt: string; kind: "catatan" | "tips" }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  switch (type) {
    case "quiz":
      return { items: text.split(/\r?\n\s*\r?\n/).map((blk) => blk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)).filter((b) => b.length >= 3).map((b) => {
        const opts = b.slice(1);
        return { q: b[0], options: opts.map((o) => o.replace(/^\*/, "").trim()), answer: Math.max(0, opts.findIndex((o) => o.startsWith("*"))) };
      }) };
    case "flashcard": return { cards: lines.filter(Boolean).map((l) => { const [a, ...r] = l.split("|"); return { front: a.trim(), back: r.join("|").trim() }; }) };
    case "fill": return { items: lines.filter(Boolean).map((l) => { const [t, ...r] = l.split("=>"); return { text: t.trim(), answers: r.join("=>").split(";").map((a) => a.trim().replace(/\s*\/\s*/g, "|")).filter(Boolean) }; }) };
    case "match": return { pairs: lines.filter(Boolean).map((l) => { const [a, ...r] = l.split("|"); return { left: a.trim(), right: r.join("|").trim() }; }) };
    case "timer": return { minutes: extra.minutes, ...(extra.prompt ? { prompt: extra.prompt } : {}) };
    case "note": return { kind: extra.kind, text: text.trim() };
  }
}

function BlockDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (a: { type: string; config: string; topic: string; bid: string }) => void }) {
  const [type, setType] = useState<BlockType>("quiz");
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"catatan" | "tips">("catatan");
  const [err, setErr] = useState("");
  const scored = (SCORED as string[]).includes(type);

  function insert() {
    setErr("");
    if (scored && !TOPIC_RE.test(topic.trim())) return setErr('Topik wajib, format "skill:topic" (mis. structure:subject-verb agreement)');
    const cfg = buildConfig(type, text, { minutes, prompt, kind });
    const ok = blockSchemas[type].safeParse(cfg);
    if (!ok.success) return setErr("Isi blok belum lengkap/valid. Periksa format contoh di atas kolom isi.");
    onInsert({ type, config: JSON.stringify(ok.data), topic: scored ? topic.trim() : "", bid: Math.random().toString(36).slice(2, 10) });
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Blok interaktif">
      <div className="my-6 w-full max-w-xl rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-navy">Blok interaktif</h2><button aria-label="Tutup" onClick={onClose} className="text-2xl leading-none text-ink-soft">×</button></div>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1.5 font-semibold text-navy">Jenis blok<select className="field font-normal" value={type} onChange={(e) => { setType(e.target.value as BlockType); setText(""); setErr(""); }}>{BLOCK_TYPES.map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}</select></label>
          {scored && <label className="flex flex-col gap-1.5 font-semibold text-navy">Tag topik (wajib) <input className="field font-normal" placeholder="structure:subject-verb agreement" value={topic} onChange={(e) => setTopic(e.target.value)} /><span className="text-xs font-normal text-ink-soft">Hasil tiap butir masuk ke statistik topik peserta.</span></label>}
          {type === "timer" ? (
            <>
              <label className="flex flex-col gap-1.5 font-semibold text-navy">Durasi (menit)<input className="field font-normal" type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
              <label className="flex flex-col gap-1.5 font-semibold text-navy">Petunjuk (opsional)<input className="field font-normal" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
            </>
          ) : type === "note" ? (
            <>
              <label className="flex flex-col gap-1.5 font-semibold text-navy">Jenis<select className="field font-normal" value={kind} onChange={(e) => setKind(e.target.value as "catatan" | "tips")}><option value="catatan">Catatan</option><option value="tips">Tips</option></select></label>
              <label className="flex flex-col gap-1.5 font-semibold text-navy">Isi<textarea className="field h-24 py-2 font-normal" value={text} onChange={(e) => setText(e.target.value)} /></label>
            </>
          ) : (
            <label className="flex flex-col gap-1.5 font-semibold text-navy">Isi<span className="whitespace-pre-line text-xs font-normal text-ink-soft">{HELP[type]}</span><textarea className="field h-40 py-2 font-mono text-xs font-normal" value={text} onChange={(e) => setText(e.target.value)} /></label>
          )}
          {err && <p role="alert" className="text-red-700">{err}</p>}
          <p className="text-xs text-ink-soft">Untuk mengubah blok yang sudah disisipkan: hapus lalu buat ulang.</p>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={onClose}>Batal</button><button className="btn-solid" onClick={insert}>Sisipkan</button></div>
        </div>
      </div>
    </div>
  );
}

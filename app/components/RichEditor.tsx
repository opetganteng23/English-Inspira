"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import CharacterCount from "@tiptap/extension-character-count";
import { uploadImage } from "@/lib/compress-image";

/** Blok pemutar audio: hanya menyimpan id audio; URL bertanda tangan disisipkan server saat materi ditampilkan. */
const AudioBlock = Node.create({
  name: "audioBlock", group: "block", atom: true, draggable: true,
  addAttributes() { return { audioId: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-audio-id"), renderHTML: (a: { audioId?: string }) => ({ "data-audio-id": a.audioId }) } }; },
  parseHTML() { return [{ tag: "audio[data-audio-id]" }]; },
  renderHTML({ HTMLAttributes }) { return ["audio", mergeAttributes(HTMLAttributes, { controls: "controls" })]; },
});

type AudioItem = { id: string; title: string; durationSec: number };

export function RichEditor({ initial, onChange, audios }: { initial?: unknown; onChange: (json: unknown, html: string) => void; audios: AudioItem[] }) {
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }), Image, TextAlign.configure({ types: ["heading", "paragraph"] }), Highlight, TextStyle, Color, Subscript, Superscript,
      TaskList, TaskItem.configure({ nested: true }), Table.configure({ resizable: false }), TableRow, TableCell, TableHeader, Youtube.configure({ width: 560, height: 315, nocookie: true }), CharacterCount, AudioBlock,
    ],
    content: (initial as object) || "",
    editorProps: { attributes: { class: "prose-ei min-h-[280px] rounded-b-xl border border-line-strong bg-white p-4 outline-none focus:border-brand", "aria-label": "Isi materi" } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON(), e.getHTML()),
  });
  useEffect(() => { if (editor) onChange(editor.getJSON(), editor.getHTML()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [editor]);
  if (!editor) return <div className="h-72 animate-pulse rounded-xl bg-canvas" />;

  async function addImage(f?: File) {
    if (!f) return; setErr("");
    try { const a = await uploadImage(f); editor!.chain().focus().setImage({ src: a.url, alt: f.name.replace(/\.\w+$/, "") }).run(); } // gambar → assets; HTML hanya menyimpan /api/assets/ID
    catch (e) { setErr((e as Error).message); }
  }
  function addLink() {
    const url = window.prompt("Alamat tautan (https://…)");
    if (url === null) return;
    if (url === "") editor!.chain().focus().unsetLink().run(); else editor!.chain().focus().setLink({ href: url }).run();
  }
  function addYoutube() { const url = window.prompt("URL video YouTube"); if (url) editor!.commands.setYoutubeVideo({ src: url }); }

  return (
    <div>
      <Toolbar editor={editor} onImage={() => file.current?.click()} onLink={addLink} onYoutube={addYoutube} audios={audios} />
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ""; }} />
      {err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}
      <EditorContent editor={editor} />
      <p className="mt-1 text-right text-xs text-ink-soft">{editor.storage.characterCount.words()} kata</p>
    </div>
  );
}

function Toolbar({ editor: e, onImage, onLink, onYoutube, audios }: { editor: Editor; onImage: () => void; onLink: () => void; onYoutube: () => void; audios: AudioItem[] }) {
  const B = ({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) => (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={on} className={`flex h-9 min-w-[36px] items-center justify-center rounded-md px-2 text-sm font-semibold ${active ? "bg-navy text-white" : "text-navy hover:bg-brand-tint"}`}>{children}</button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-line-strong bg-canvas p-2" role="toolbar" aria-label="Format teks">
      <select aria-label="Gaya paragraf" className="h-9 rounded-md border border-line-strong bg-white px-2 text-sm" value={e.isActive("heading", { level: 2 }) ? "2" : e.isActive("heading", { level: 3 }) ? "3" : "p"} onChange={(ev) => { const v = ev.target.value; if (v === "p") e.chain().focus().setParagraph().run(); else e.chain().focus().toggleHeading({ level: Number(v) as 2 | 3 }).run(); }}><option value="p">Paragraf</option><option value="2">Judul</option><option value="3">Subjudul</option></select>
      <B label="Tebal" active={e.isActive("bold")} on={() => e.chain().focus().toggleBold().run()}><b>B</b></B>
      <B label="Miring" active={e.isActive("italic")} on={() => e.chain().focus().toggleItalic().run()}><i>I</i></B>
      <B label="Garis bawah" active={e.isActive("underline")} on={() => e.chain().focus().toggleUnderline().run()}><u>U</u></B>
      <B label="Coret" active={e.isActive("strike")} on={() => e.chain().focus().toggleStrike().run()}><s>S</s></B>
      <B label="Highlight" active={e.isActive("highlight")} on={() => e.chain().focus().toggleHighlight().run()}>▮</B>
      <input aria-label="Warna teks" type="color" className="h-9 w-9 cursor-pointer rounded-md border border-line-strong bg-white p-1" onChange={(ev) => e.chain().focus().setColor(ev.target.value).run()} />
      <B label="Subskrip" active={e.isActive("subscript")} on={() => e.chain().focus().toggleSubscript().run()}>x₂</B>
      <B label="Superskrip" active={e.isActive("superscript")} on={() => e.chain().focus().toggleSuperscript().run()}>x²</B>
      <span className="mx-1 h-6 w-px bg-line-strong" />
      <B label="Daftar poin" active={e.isActive("bulletList")} on={() => e.chain().focus().toggleBulletList().run()}>•≡</B>
      <B label="Daftar nomor" active={e.isActive("orderedList")} on={() => e.chain().focus().toggleOrderedList().run()}>1.</B>
      <B label="Checklist" active={e.isActive("taskList")} on={() => e.chain().focus().toggleTaskList().run()}>☑</B>
      <B label="Kutipan" active={e.isActive("blockquote")} on={() => e.chain().focus().toggleBlockquote().run()}>“</B>
      <B label="Blok kode" active={e.isActive("codeBlock")} on={() => e.chain().focus().toggleCodeBlock().run()}>{"</>"}</B>
      <span className="mx-1 h-6 w-px bg-line-strong" />
      {(["left", "center", "right", "justify"] as const).map((a) => <B key={a} label={`Rata ${a}`} active={e.isActive({ textAlign: a })} on={() => e.chain().focus().setTextAlign(a).run()}>{a === "left" ? "⇤" : a === "center" ? "↔" : a === "right" ? "⇥" : "☰"}</B>)}
      <span className="mx-1 h-6 w-px bg-line-strong" />
      <B label="Tautan" active={e.isActive("link")} on={onLink}>🔗</B>
      <B label="Sisipkan gambar" on={onImage}>🖼</B>
      <B label="Sisipkan video YouTube" on={onYoutube}>▶</B>
      <B label="Sisipkan tabel" on={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</B>
      <select aria-label="Sisipkan audio" className="h-9 max-w-[160px] rounded-md border border-line-strong bg-white px-2 text-sm" value="" onChange={(ev) => { if (ev.target.value) e.chain().focus().insertContent({ type: "audioBlock", attrs: { audioId: ev.target.value } }).run(); }}><option value="">🔊 Sisipkan audio</option>{audios.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.durationSec}s)</option>)}</select>
      <span className="mx-1 h-6 w-px bg-line-strong" />
      <B label="Urungkan" on={() => e.chain().focus().undo().run()}>↶</B>
      <B label="Ulangi" on={() => e.chain().focus().redo().run()}>↷</B>
    </div>
  );
}

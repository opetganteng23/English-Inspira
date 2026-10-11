"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { uploadImage } from "@/lib/compress-image";
import { Loading, ErrorNote } from "@/components/Charts";

type Item = { id: string; name: string; mime: string; size: number; width: number | null; height: number | null; url: string; usage: { kind: string; count: number }[] };
type Data = { total: number; page: number; size: number; library: { files: number; bytes: number }; items: Item[] };
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const KIND: Record<string, string> = { question: "question", passage: "passage", material: "material", course: "course cover", settings: "settings" };

export default function Media() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<Data>(`/api/admin/media?page=${page}&q=${encodeURIComponent(q)}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(""); setMsg("");
    let ok = 0;
    try {
      for (const f of [...files]) { await uploadImage(f, { name: f.name }); ok++; }
      setMsg(`${ok} image${ok > 1 ? "s" : ""} uploaded. Duplicates reuse the existing image.`);
    } catch (e) { setErr(`${(e as Error).message}${ok ? ` (${ok} uploaded before the error)` : ""}`); }
    setBusy(false); setPage(1); reload();
  }
  const run = async (fn: () => Promise<unknown>, ok = "") => { setErr(""); setMsg(""); try { await fn(); setMsg(ok); reload(); } catch (e) { setErr((e as Error).message); } };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Media Library</h1><p className="text-sm text-ink-soft">Images used in questions, passages, materials, course covers, and the landing page.{data ? ` ${data.library.files} files, ${kb(data.library.bytes)}.` : ""} Images are compressed in your browser before upload.</p></div>
        <label className={`btn-solid cursor-pointer ${busy ? "opacity-60" : ""}`}>{busy ? "Uploading…" : "+ Upload images"}<input type="file" accept="image/*" multiple hidden disabled={busy} aria-label="Upload images" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
      </div>
      <input className="field max-w-sm" type="search" placeholder="Search by file name" aria-label="Search images" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <ErrorNote text={error || err} />
      {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      {loading && !data ? <Loading /> : data && data.items.length === 0 ? <p className="card text-sm text-ink-soft">{q ? "No images match your search." : "No images yet. Upload one to start."}</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {data?.items.map((m) => (
            <li key={m.id} className="card flex flex-col gap-2 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.name || "Uploaded image"} loading="lazy" className="h-28 w-full rounded-lg bg-canvas object-contain" />
              <div className="min-w-0">
                {rename?.id === m.id
                  ? <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); run(async () => { await api(`/api/admin/media/${m.id}`, { method: "PATCH", json: { name: rename.name } }); setRename(null); }, "Renamed"); }}><input className="field min-h-[36px] py-1 text-sm" autoFocus aria-label="Image name" value={rename.name} onChange={(e) => setRename({ id: m.id, name: e.target.value })} /><button className="text-sm font-semibold text-brand">Save</button></form>
                  : <p className="truncate text-sm font-semibold text-navy" title={m.name}>{m.name || "Untitled"}</p>}
                <p className="text-xs text-ink-soft">{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{kb(m.size)}</p>
              </div>
              <p className="min-h-[1.25rem]">{m.usage.length ? <span className="badge-ok">In use: {m.usage.map((u) => `${u.count} ${KIND[u.kind] ?? u.kind}`).join(", ")}</span> : <span className="badge-muted">Not used</span>}</p>
              <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold">
                <button className="text-brand" onClick={() => { navigator.clipboard?.writeText(`${location.origin}${m.url}`); setMsg("Image URL copied"); }}>Copy URL</button>
                <button className="text-brand" onClick={() => setRename({ id: m.id, name: m.name })}>Rename</button>
                <button className="text-red-700" onClick={() => confirm("Delete this image?") && run(() => api(`/api/admin/media/${m.id}`, { method: "DELETE" }), "Image deleted")}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && <div className="flex items-center justify-center gap-3 text-sm"><button className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn-outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

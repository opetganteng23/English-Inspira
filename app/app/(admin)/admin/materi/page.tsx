"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type M = { id: string; title: string; slug: string; kind: "rich" | "html"; status: "draft" | "published"; access: "free" | "paid"; version: number; tags: string[]; updatedAt: string };

export default function MateriAdmin() {
  const { data, loading, error, reload } = useApi<{ materials: M[] }>("/api/admin/materials");
  const [err, setErr] = useState("");
  async function act(id: string, action: "publish" | "unpublish") { setErr(""); try { await api(`/api/admin/materials/${id}/publish`, { json: { action } }); reload(); } catch (e) { setErr((e as Error).message); } }
  async function remove(id: string) { if (!confirm("Hapus materi ini beserta riwayat versinya?")) return; try { await api(`/api/admin/materials/${id}`, { method: "DELETE" }); reload(); } catch (e) { setErr((e as Error).message); } }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Materi</h1><p className="text-sm text-ink-soft">Bacaan (rich text) dan latihan interaktif (HTML halaman penuh).</p></div><Link href="/admin/materi/baru" className="btn-solid">+ Materi baru</Link></div>
      <ErrorNote text={error || err} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Judul</th><th>Jenis</th><th>Akses</th><th>Status</th><th>Versi</th><th>Diubah</th><th /></tr></thead>
          <tbody>
            {data?.materials.map((m) => (
              <tr key={m.id}><td className="font-semibold text-navy">{m.title}<br /><span className="text-xs font-normal text-ink-soft">/{m.slug}{m.tags.length ? ` · ${m.tags.join(", ")}` : ""}</span></td><td>{m.kind === "html" ? "HTML interaktif" : "Rich text"}</td><td>{m.access === "free" ? "Gratis" : "Berbayar"}</td><td><span className={m.status === "published" ? "badge-ok" : "badge-muted"}>{m.status === "published" ? "Terbit" : "Draft"}</span></td><td>{m.version || "–"}</td><td>{tgl(m.updatedAt)}</td>
                <td className="whitespace-nowrap text-right"><Link className="mr-3 font-semibold text-brand" href={`/admin/materi/${m.id}`}>Edit</Link>{m.status === "published" ? <button className="mr-3 font-semibold text-brand" onClick={() => act(m.id, "unpublish")}>Tarik</button> : <button className="mr-3 font-semibold text-brand" onClick={() => act(m.id, "publish")}>Terbitkan</button>}<button className="font-semibold text-red-700" onClick={() => remove(m.id)}>Hapus</button></td></tr>
            ))}
            {data?.materials.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">Belum ada materi.</td></tr>}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { useMaterialBase } from "@/lib/use-material-base";

type M = { id: string; title: string; slug: string; kind: "rich" | "html"; status: "draft" | "review" | "published"; version: number; tags: string[]; updatedAt: string };

export default function MateriAdmin() {
  const { base } = useMaterialBase();
  const { data, loading, error, reload } = useApi<{ materials: M[] }>("/api/admin/materials");
  const [err, setErr] = useState("");
  async function act(id: string, action: "publish" | "unpublish" | "submit_review" | "reject", note?: string) { setErr(""); try { await api(`/api/admin/materials/${id}/publish`, { json: { action, note } }); reload(); } catch (e) { setErr((e as Error).message); } }
  async function remove(id: string) { if (!confirm("Delete this material and its version history?")) return; try { await api(`/api/admin/materials/${id}`, { method: "DELETE" }); reload(); } catch (e) { setErr((e as Error).message); } }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Materials</h1><p className="text-sm text-ink-soft">Readings (rich text) and interactive exercises (full-page HTML).</p></div><Link href={`${base}/new`} className="btn-solid">+ New material</Link></div>
      <ErrorNote text={error || err} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Version</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {data?.materials.map((m) => (
              <tr key={m.id}><td className="font-semibold text-navy">{m.title}<br /><span className="text-xs font-normal text-ink-soft">/{m.slug}{m.tags.length ? ` · ${m.tags.join(", ")}` : ""}</span></td><td>{m.kind === "html" ? "Interactive HTML" : "Rich text"}</td><td><span className={m.status === "published" ? "badge-ok" : m.status === "review" ? "badge-warn" : "badge-muted"}>{m.status === "published" ? "Published" : m.status === "review" ? "Awaiting review" : "Draft"}</span></td><td>{m.version || "-"}</td><td>{tgl(m.updatedAt)}</td>
                <td className="whitespace-nowrap text-right"><Link className="mr-3 font-semibold text-brand" href={`${base}/${m.id}`}>Edit</Link>{m.status === "published" ? <button className="mr-3 font-semibold text-brand" onClick={() => act(m.id, "unpublish")}>Unpublish</button>
                  : m.status === "review" ? <><button className="mr-3 font-semibold text-brand" onClick={() => act(m.id, "publish")}>Approve & publish</button><button className="mr-3 font-semibold text-red-700" onClick={() => { const note = prompt("Rejection reason?"); if (note) act(m.id, "reject", note); }}>Reject</button></>
                  : m.kind === "html" ? <button className="mr-3 font-semibold text-brand" onClick={() => act(m.id, "submit_review")}>Submit for review</button>
                  : <button className="mr-3 font-semibold text-brand" onClick={() => act(m.id, "publish")}>Publish</button>}<button className="font-semibold text-red-700" onClick={() => remove(m.id)}>Delete</button></td></tr>
            ))}
            {data?.materials.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">No materials yet.</td></tr>}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

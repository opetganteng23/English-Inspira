"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";
import { MaterialFrame } from "@/components/MaterialFrame";
import { RichViewer } from "@/components/RichViewer";
import { useActiveTime } from "@/lib/use-active-time";

type Mat = { id: string; title: string; summary?: string; kind: "rich" | "html"; tags: string[]; contentHtml?: string; htmlDoc?: { html: string; css: string; js: string }; progress: { score: number | null; completed: boolean; attempts: number } | null };

export default function MateriViewer({ params }: { params: { slug: string } }) {
  const { data, loading, error } = useApi<Mat>(`/api/materials/${params.slug}`);
  const [toast, setToast] = useState("");
  useActiveTime("material", data?.id ?? null);
  // Skor dari materi diteruskan induk ke API; materi sendiri tidak pernah memanggil API.
  const onProgress = useCallback(async (score: number, answers: unknown, final: boolean) => {
    try { await api(`/api/materials/${params.slug}/progress`, { json: { score, answers, final } }); if (final) setToast(`Score ${Math.round(score)} saved.`); }
    catch (e) { setToast((e as Error).message); }
    setTimeout(() => setToast(""), 4000);
  }, [params.slug]);

  if (loading) return <Loading />;
  if (error && !data) {
    return <div className="card max-w-lg"><ErrorNote text={error} /><Link href="/materials" className="mt-3 block text-sm font-semibold text-brand">All materials</Link></div>;
  }
  if (!data) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link href="/materials" className="text-sm font-semibold text-brand">All materials</Link>
      <div><h1 className="page-title">{data.title}</h1>{data.summary && <p className="mt-1 text-ink-soft">{data.summary}</p>}{data.progress?.completed && <p className="mt-1 text-sm text-success">Last score {data.progress.score} · {data.progress.attempts}× attempted</p>}</div>
      {toast && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{toast}</p>}
      {data.kind === "html" && data.htmlDoc
        ? <MaterialFrame doc={data.htmlDoc} onProgress={onProgress} />
        : <>
            <article className="card"><RichViewer html={data.contentHtml ?? ""} materialId={data.id} /></article>
            <button className="btn-solid self-start" onClick={() => onProgress(100, null, true)}>{data.progress?.completed ? "Mark as done again" : "Mark as studied"}</button>
          </>}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type M = { id: string; title: string; slug: string; summary?: string; kind: "rich" | "html"; tags: string[]; locked: boolean; progress: { score: number | null; completed: boolean } | null };

export default function Materi() {
  const { data, loading, error } = useApi<{ materials: M[] }>("/api/materials");
  const [tag, setTag] = useState("");
  if (loading) return <Loading />;
  const all = data?.materials ?? [];
  const tags = Array.from(new Set(all.flatMap((m) => m.tags)));
  const list = all.filter((m) => !tag || m.tags.includes(tag));
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Materi</h1><p className="mt-1 text-ink-soft">Materi dan latihan interaktif untuk memperkuat kelemahanmu.</p></div>
      <ErrorNote text={error} />
      {tags.length > 0 && <div className="flex flex-wrap gap-2">{["", ...tags].map((t) => <button key={t || "all"} onClick={() => setTag(t)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${tag === t ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-navy"}`}>{t || "Semua"}</button>)}</div>}
      {list.length === 0 ? <Empty>Belum ada materi yang dipublikasikan.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <Link key={m.id} href={`/materi/${m.slug}`} className={`card flex flex-col gap-2 hover:border-brand ${m.locked ? "bg-canvas" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-muted">{m.kind === "html" ? "Latihan interaktif" : "Bacaan"}</span>
                {m.progress?.completed && <span className="badge-ok">Skor {m.progress.score ?? "–"}</span>}
              </div>
              <h2 className="font-display text-lg font-extrabold text-navy">{m.title}</h2>
              {m.summary && <p className="flex-1 text-sm text-ink-soft">{m.summary}</p>}
              <p className="text-sm font-semibold text-brand">{m.progress ? "Buka lagi →" : "Mulai belajar →"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

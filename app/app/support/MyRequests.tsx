"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";

type T = { id: string; number: number; category: string; status: string; statusLabel: string; urgent: boolean; preview: string; unread: boolean; updatedAt: string };

/** My requests (8.3): riwayat permintaan dan tanda balasan baru. */
export function MyRequests() {
  const { data } = useApi<{ tickets: T[] }>("/api/support");
  if (!data?.tickets.length) return null;
  return (
    <section className="card">
      <h2 className="mb-2 font-display text-lg font-extrabold text-navy">My requests</h2>
      <ul className="flex flex-col divide-y divide-line">
        {data.tickets.map((t) => (
          <li key={t.id}>
            <Link href={`/support/${t.id}`} className="flex items-start justify-between gap-3 py-3 hover:text-brand">
              <span className="min-w-0"><b className="text-navy">#{t.number} · {t.category}</b>{t.unread && <span className="badge-warn ml-2">New reply</span>}<span className="block truncate text-sm text-ink-soft">{t.preview}</span></span>
              <span className={t.status === "resolved" ? "badge-ok" : "badge-muted"}>{t.statusLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { rupiah, tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type I = { id: string; number: string; description: string; amount: number; status: "unpaid" | "paid"; dueDate: string | null; paidAt: string | null };

export default function Tagihan() {
  const { url, ready } = useInstQuery();
  const { data, loading, error } = useApi<{ invoices: I[] }>(url("/api/inst/invoices"));
  if (!ready || loading) return <Loading />;
  const unpaid = (data?.invoices ?? []).filter((i) => i.status === "unpaid").reduce((n, i) => n + i.amount, 0);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Tagihan & invoice</h1><p className="text-sm text-ink-soft">Tagihan resmi untuk institusimu. Pembayaran dikonfirmasi admin.</p></div>
      <ErrorNote text={error} />
      {!!unpaid && <p className="rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">Total belum dibayar: <b>{rupiah(unpaid)}</b></p>}
      {data?.invoices.length === 0 ? <Empty>Belum ada tagihan.</Empty> : (
        <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Deskripsi</th><th>Jumlah</th><th>Jatuh tempo</th><th>Status</th></tr></thead>
          <tbody>{data?.invoices.map((i) => <tr key={i.id}><td className="font-semibold text-navy">{i.number}</td><td>{i.description}</td><td className="whitespace-nowrap">{rupiah(i.amount)}</td><td>{i.dueDate ? tgl(i.dueDate) : "–"}</td><td><span className={i.status === "paid" ? "badge-ok" : "badge-warn"}>{i.status === "paid" ? `Lunas${i.paidAt ? ` · ${tgl(i.paidAt)}` : ""}` : "Belum dibayar"}</span></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

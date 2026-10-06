"use client";

import { useInstQuery } from "@/lib/inst-client";
import { Loading } from "@/components/Charts";

export default function Laporan() {
  const { url, ready } = useInstQuery();
  if (!ready) return <Loading />;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div><h1 className="page-title">Laporan</h1><p className="text-sm text-ink-soft">Unduh data hasil kelompok untuk arsip atau dibagikan ke pimpinan.</p></div>
      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Laporan peserta (Excel)</h2>
        <p className="text-sm text-ink-soft">Per peserta: target, jumlah tes, skor pertama dan terakhir, skor tiap section, dan tanggal tes terakhir. Setiap unduhan dicatat di audit log.</p>
        <a className="btn-solid self-start" href={url("/api/inst/report.xlsx") ?? "#"}>Unduh laporan Excel</a>
      </section>
      <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Ringkasan kelompok</h2><p className="mt-1 text-sm text-ink-soft">Grafik sebaran skor, kelemahan umum, dan peserta yang perlu perhatian ada di halaman Ringkasan. Gunakan cetak browser (Ctrl+P) untuk menyimpannya sebagai PDF.</p></section>
    </div>
  );
}

/**
 * Jenis pengerjaan yang bukan tes skala EPTA penuh: quiz unit dan ujian per bagian hanya mencakup sebagian materi.
 * Skor "EPTA" yang dihitung dari beberapa soal tidak bermakna, jadi hasilnya dilaporkan sebagai persen benar dan tidak
 * masuk grafik tren skor, perbandingan level, atau kemajuan EPTA peserta.
 */
export const PARTIAL_KINDS = ["quiz", "section"] as const;
export const isPartialKind = (kind?: string | null) => kind === "quiz" || kind === "section";

/** Persen benar dari skor per section (semua section digabung). */
export function percentOf(sections: { raw?: number | null; total?: number | null }[]) {
  const raw = sections.reduce((a, s) => a + (s.raw ?? 0), 0), total = sections.reduce((a, s) => a + (s.total ?? 0), 0);
  return total ? Math.round((raw / total) * 1000) / 10 : 0;
}

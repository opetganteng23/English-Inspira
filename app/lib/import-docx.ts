import { QUESTION_TEMPLATE_HEADER } from "./import-questions";

/**
 * Impor soal dari teks Word (.docx). Bagian murni (tanpa pustaka Word) supaya mudah diuji.
 *
 * Format dokumen:
 *   Section: structure          <- baris pengaturan berlaku untuk soal di bawahnya sampai diganti
 *   Type: subject-verb
 *   Difficulty: medium
 *   Tags: structure:subject-verb agreement
 *   Status: draft
 *   1. The results of the study ___ clear.
 *   A. is
 *   B. are
 *   Answer: B
 *   Explanation: The plural subject takes "are".
 * Soal dimulai dari baris bernomor ("1." atau "1)"). Baris lanjutan menyambung stem, pilihan, atau pembahasan terakhir.
 */
const META: Record<string, number> = { section: 0, type: 1, difficulty: 9, tags: 10, status: 11 }; // indeks kolom templat
const IDX = Object.fromEntries(QUESTION_TEMPLATE_HEADER.map((h, i) => [h.toLowerCase(), i]));

export function docxTextToTable(text: string): string[][] {
  const header = [...QUESTION_TEMPLATE_HEADER];
  const rows: string[][] = [header];
  const meta: Record<string, string> = {};
  let cur: string[] | null = null;
  let last: number | null = null; // kolom yang sedang disambung baris lanjutan

  const flush = () => {
    if (!cur) return;
    for (const [k, i] of Object.entries(META)) if (!cur[i]) cur[i] = meta[k] ?? "";
    rows.push(cur);
    cur = null; last = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ").trim();
    if (!line) continue;
    const m = /^(section|type|difficulty|tags?|status)\s*[:=]\s*(.*)$/i.exec(line);
    if (m) { flush(); const k = m[1].toLowerCase().replace(/^tags$/, "tags"); meta[k === "tag" ? "tags" : k] = m[2].trim(); continue; }

    const q = /^(\d{1,4})\s*[.)]\s+(.+)$/.exec(line);
    if (q) { flush(); cur = header.map(() => ""); cur[IDX.stem] = q[2]; last = IDX.stem; continue; }
    if (!cur) continue;

    const opt = /^\(?([A-Fa-f])[.)]\s+(.+)$/.exec(line);
    if (opt) { last = IDX[opt[1].toLowerCase()] ?? IDX[opt[1].toUpperCase().toLowerCase()]; cur[last] = opt[2]; continue; }
    const ans = /^(answer|jawaban|kunci)\s*[:=]\s*\(?([A-Fa-f1-6])\)?\b/i.exec(line);
    if (ans) { cur[IDX.answer] = ans[2].toUpperCase(); last = null; continue; }
    const ex = /^(explanation|pembahasan|penjelasan)\s*[:=]\s*(.*)$/i.exec(line);
    if (ex) { cur[IDX.explanation] = ex[2]; last = IDX.explanation; continue; }
    if (last !== null) cur[last] = `${cur[last]} ${line}`.trim();
  }
  flush();
  return rows;
}

/** Baca teks polos dari .docx. Pustaka dimuat saat dipakai agar tidak membebani rute lain. */
export async function readDocxText(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const r = await mammoth.extractRawText({ buffer: buf });
  return r.value;
}

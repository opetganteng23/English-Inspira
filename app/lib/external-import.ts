import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { readTable } from "./import-parse";
import { isPdf, MAX_PDF_BYTES, parseItpScores } from "./pdf-import";
import { matchPerson, findNameInText, normName, type Person } from "./name-match";
import { toItp, type Equivalence, type ExternalScale } from "./score-equivalence";
import { ExternalResult } from "@/models/Cluster";
import { pdfBucket } from "@/models/Pdf";

const COL: Record<string, string[]> = {
  name: ["name", "nama", "full name", "nama lengkap", "participant", "peserta"],
  email: ["email", "e-mail", "surel"],
  score: ["score", "skor", "total", "total score", "nilai", "result"],
  date: ["date", "tanggal", "test date", "tanggal tes"],
  test: ["test", "tes", "source", "jenis tes"],
};

/** Ambil skor dari teks PDF: format laporan ITP dulu, lalu angka setelah kata score/skor/total. */
export function scoreFromText(text: string, scale: Equivalence["oce"]) {
  if (scale.sameAsItp) { const t = parseItpScores(text).scores.total; if (t !== undefined) return t; }
  for (const m of text.matchAll(/(?:overall|total|score|skor|nilai)[^\d\n]{0,25}(\d{1,3}(?:[.,]\d)?)/gi)) {
    const v = Number(m[1].replace(",", "."));
    if (v >= scale.min && v <= scale.max) return v;
  }
  return undefined;
}

const parseDate = (s: string) => { const d = s ? new Date(s) : null; return d && !isNaN(+d) ? d : undefined; };

/**
 * Simpan satu unggahan admin sebagai batch hasil `pending`. Spreadsheet: satu baris = satu orang.
 * PDF: satu berkas = satu orang; nama dicari di isi PDF, lalu di nama berkas.
 */
export async function importExternal(files: File[], source: ExternalScale, people: Person[], eq: Equivalence, uploadedBy: Types.ObjectId) {
  const batchId = randomUUID();
  const docs: Record<string, unknown>[] = [];
  const errors: { file: string; reason: string }[] = [];
  const scale = eq[source];
  const toDoc = (rawName: string, rawEmail: string | undefined, score: number | undefined, extra: Record<string, unknown>, nameHit?: Person | null) => {
    const cands = nameHit ? [{ ...nameHit, confidence: 1 }] : matchPerson(rawName, rawEmail, people);
    const best = cands[0];
    const valid = score !== undefined && score >= scale.min && score <= scale.max;
    return {
      batchId, source, rawName, rawEmail, uploadedBy, ...extra,
      score: valid ? score : undefined, itpScore: valid ? toItp(score!, source, eq) : undefined,
      userId: best && best.confidence >= 0.8 ? best.id : undefined, matchConfidence: best?.confidence ?? 0,
      candidates: cands.map((c) => ({ userId: c.id, name: c.name, email: c.email, confidence: c.confidence })),
    };
  };

  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      if (f.size > MAX_PDF_BYTES) { errors.push({ file: f.name, reason: "Maximum 10 MB per PDF" }); continue; }
      const buf = Buffer.from(await f.arrayBuffer());
      if (!isPdf(buf)) { errors.push({ file: f.name, reason: "Not a valid PDF" }); continue; }
      let text = "";
      try { const { PDFParse } = await import("pdf-parse"); const p = new PDFParse({ data: new Uint8Array(buf) }); text = (await p.getText()).text ?? ""; await p.destroy?.(); } catch { /* PDF hasil scan: isi manual */ }
      const up = (await pdfBucket()).openUploadStream(f.name, { metadata: { kind: "external-result", batchId } });
      await new Promise<void>((res, rej) => { Readable.from(buf).pipe(up).on("finish", () => res()).on("error", rej); });
      const fromName = f.name.replace(/\.pdf$/i, "").replace(/[_\-.]+/g, " ").replace(/\b(pure|oce|result|hasil|score|skor|toefl|itp)\b/gi, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
      const inText = text ? findNameInText(text, people) : null;
      docs.push(toDoc(inText?.name ?? fromName, undefined, text ? scoreFromText(text, scale) : undefined, { fileName: f.name, fileId: up.id }, inText));
    } else if (lower.endsWith(".csv") || lower.endsWith(".xlsx")) {
      let table: string[][];
      try { table = await readTable(f, 2000); } catch (e) { errors.push({ file: f.name, reason: (e as Error).message }); continue; }
      const head = new Map(table[0].map((h, i) => [h.toLowerCase().trim(), i] as const));
      const col = (k: string) => COL[k].map((a) => head.get(a)).find((x) => x !== undefined);
      if (col("name") === undefined || col("score") === undefined) { errors.push({ file: f.name, reason: "Columns name and score are required" }); continue; }
      for (const r of table.slice(1)) {
        const g = (k: string) => (col(k) !== undefined ? String(r[col(k)!] ?? "").trim() : "");
        if (!g("name")) continue;
        const test = g("test").toLowerCase();
        const src = test === "pure" || test === "oce" ? (test as ExternalScale) : source;
        const raw = g("score").replace(",", ".");
        const s = raw === "" ? undefined : Number(raw);
        const d = toDoc(g("name"), g("email") || undefined, Number.isFinite(s) ? s : undefined, { testDate: parseDate(g("date")), fileName: f.name });
        if (src !== source) Object.assign(d, { source: src, itpScore: d.score !== undefined ? toItp(d.score as number, src, eq) : undefined });
        docs.push(d);
      }
    } else errors.push({ file: f.name, reason: "Use .csv, .xlsx, or .pdf" });
  }
  if (!docs.length && errors.length) throw new HttpError(400, errors.map((e) => `${e.file}: ${e.reason}`).join("; "));
  if (docs.length > 2000) throw new HttpError(413, "Maximum 2,000 results per upload");
  await ExternalResult.insertMany(docs);
  return { batchId, created: docs.length, matched: docs.filter((d) => d.userId).length, errors };
}

export const nameKey = normName;

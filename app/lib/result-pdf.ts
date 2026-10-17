import PDFDocument from "pdfkit";
import path from "node:path";
import { buildBreakdown, partLabel, typeLabel } from "./breakdown";

// Poppins dan palet sama dengan PDF lain (lib/pdf.ts).
const FONT = (w: string) => path.join(process.cwd(), "public", "fonts", `poppins-${w}.ttf`);
const NAVY = "#0A2257", BLUE = "#0B4FA6", GRAY = "#4B5A70", LINE = "#DCE3ED";
const fmt = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export type ResultPdfData = {
  name: string; testName: string; kindLabel: string; finishedAt: Date | string | null; durationSec: number | null;
  scoreEst: number | null; scoring: { basis: "verified" | "provisional"; name: string | null } | null;
  level: { name: string; scoreMin: number; scoreMax: number; quota: number } | null;
  equivalents: { itp: number; cefr: string; cefrLabel: string } | null;
  previous: { name: string; scoreEst: number } | null; target: number | null;
  sections: { section: string; scaled: number; raw: number; total: number }[];
  topics: { skill: string; topic: string; score: number; correct: number; total: number }[];
  analysis: { status: string; summary?: string; narrative?: string; strengths?: { topic: string; evidence: string }[]; weaknesses?: { title: string; detail: string }[]; nextSteps?: string[]; error?: string };
  recommendations: { course: string; unit: string; topic: string; score: number }[];
  unanswered?: import("./unanswered").UnansweredReport;
  insights?: import("./insights").Insights;
  summary?: import("./summary").Summary;
  courseProgress?: import("./course-progress").CourseProgressRow[];
  partial?: { percent: number; passScore: number; passed: boolean };
};

/**
 * PDF placement hanya memuat placement itu sendiri: tanpa perbandingan dengan tes lain dan tanpa kemajuan course
 * (yang berasal dari aktivitas lain dan bisa berubah setelah placement dikerjakan). Jenis lain tidak berubah.
 */
export function scopeForKind<T extends { previous: unknown; courseProgress?: unknown }>(d: T, kind?: string | null): T {
  return kind === "placement" ? { ...d, previous: null, courseProgress: undefined } : d;
}

const PART_NAMES: Record<string, string> = { listening_a: "Listening Part A", listening_b: "Listening Part B", listening_c: "Listening Part C", structure: "Structure", written_expression: "Written Expression", reading: "Reading" };
const SEC_LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

/** Hasil tes dan diagnostic satu percobaan (PDF): ringkasan skor, topik, dan analisis. Tanpa pembahasan per soal. */
export function resultPdf(d: ResultPdfData) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.registerFont("Regular", FONT("400")); doc.registerFont("Bold", FONT("700")); doc.font("Regular");
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try { build(doc, d); doc.end(); } catch (e) { reject(e); }
  });
}

function build(doc: PDFKit.PDFDocument, d: ResultPdfData) {
  const X = 48, W = 499, BOTTOM = 785;
  let y = 0;
  const ensure = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = 48; } };
  const heading = (t: string) => {
    ensure(44); y += 8;
    doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1).strokeColor(LINE).stroke(); y += 10;
    doc.font("Bold").fontSize(12).fillColor(NAVY).text(t, X, y, { width: W }); y = doc.y + 6;
  };
  const para = (t: string, o: { size?: number; color?: string; bold?: boolean; indent?: number; keep?: number } = {}) => {
    const w = W - (o.indent ?? 0);
    const style = () => doc.font(o.bold ? "Bold" : "Regular").fontSize(o.size ?? 10).fillColor(o.color ?? NAVY);
    style();
    const h = doc.heightOfString(t, { width: w });
    ensure(h + 4 + (o.keep ?? 0)); // keep: sisakan ruang agar judul tidak terpisah dari isinya
    style(); // pindah halaman mengatur ulang font dan warna
    doc.text(t, X + (o.indent ?? 0), y, { width: w }); y += h + 4;
  };

  doc.image(path.join(process.cwd(), "public", "brand", "logo.png"), X, 40, { width: 130 });
  doc.fillColor(BLUE).font("Bold").fontSize(9).text(`${d.kindLabel} RESULT`, X, 108, { characterSpacing: 1.5 });
  doc.fillColor(NAVY).fontSize(18).text(d.testName, X, 123, { width: W });
  y = doc.y + 4;
  const when = d.finishedAt ? fmt(d.finishedAt) : "";
  const dur = d.durationSec != null ? ` · finished in ${Math.floor(d.durationSec / 60)} min` : "";
  doc.fillColor(GRAY).font("Regular").fontSize(10).text(`${d.name}${when ? ` · ${when}` : ""}${dur}`, X, y, { width: W });
  y = doc.y + 14;

  // Kotak skor
  doc.roundedRect(X, y, W, 92, 12).fill(NAVY);
  doc.fillColor("#B9CBE6").font("Regular").fontSize(9).text(d.partial ? "Percent correct" : "Estimated EPTA score", X + 18, y + 14);
  doc.fillColor("#FFFFFF").font("Bold").fontSize(40).text(d.partial ? `${d.partial.percent}%` : String(d.scoreEst ?? "-"), X + 18, y + 28);
  const side: string[] = [];
  if (d.partial) { side.push(`${d.partial.passed ? "Passed" : "Not passed yet"} (pass mark ${d.partial.passScore}%)`); side.push("Covers part of the material: it does not change your EPTA score estimate or level."); }
  if (d.level) side.push(`Level: ${d.level.name} (${d.level.scoreMin}-${d.level.scoreMax})`);
  if (d.equivalents) side.push(`CEFR: ${d.equivalents.cefr} (${d.equivalents.cefrLabel.replace(/^\S+ /, "")})`);
  if (d.previous && d.scoreEst != null) { const dl = d.scoreEst - d.previous.scoreEst; side.push(`${dl > 0 ? "+" : dl < 0 ? "" : "±"}${dl} from ${d.previous.name} (${d.previous.scoreEst})`); }
  if (d.target != null && d.scoreEst != null) side.push(d.scoreEst >= d.target ? `Target ${d.target} reached` : `${d.target - d.scoreEst} points below the ${d.target} target`);
  doc.font("Regular").fontSize(10).fillColor("#FFFFFF");
  side.slice(0, 4).forEach((t, i) => doc.text(t, X + 210, y + 16 + i * 18, { width: W - 225 }));
  y += 92 + 8;
  if (d.scoring && !d.partial) para(d.scoring.basis === "verified" ? `Scored with a verified conversion${d.scoring.name ? `: ${d.scoring.name}` : ""}.` : "Provisional conversion: treat this score as a rough estimate.", { size: 8.5, color: GRAY });

  if (d.summary) {
    const sm = d.summary;
    heading("Diagnostic summary");
    para(`Reliability: ${sm.reliability.level.toUpperCase()}. ${sm.reliability.headline}.`, { bold: true, keep: 30 });
    para(sm.reliability.detail, { color: GRAY });
    if (sm.pace.avgSec != null && sm.pace.realSec != null) para(`Average ${sm.pace.avgSec}s per answer; the real test pace is about ${sm.pace.realSec}s per question.`, { size: 9, color: GRAY });
    // Statistik tes: tabel per section dan total.
    para("Test statistics", { bold: true, keep: 90 });
    const cols = [0, 130, 190, 255, 335, 390, 445], head = ["Section", "Questions", "Answered", "Not answered", "Correct", "Wrong", "Score"];
    ensure(20); doc.font("Bold").fontSize(8.5).fillColor(GRAY); head.forEach((h, k) => doc.text(h, X + cols[k], y, { width: (cols[k + 1] ?? W) - cols[k] - 4 })); y += 14;
    for (const r of [...sm.stats.rows, sm.stats.total]) {
      ensure(16);
      const vals = [r.section === "total" ? "Total" : SEC_LABEL[r.section] ?? r.section, r.total, r.answered, r.unanswered, r.correct, r.wrong, r.scaled ?? "-"];
      doc.font(r.section === "total" ? "Bold" : "Regular").fontSize(9.5).fillColor(r.unanswered > 0 && r.section !== "total" ? "#B3261E" : NAVY);
      vals.forEach((v, k) => doc.fillColor(k === 3 && r.unanswered > 0 ? "#B3261E" : NAVY).text(String(v), X + cols[k], y, { width: (cols[k + 1] ?? W) - cols[k] - 4 }));
      y += 15;
    }
    y += 4;
    if (sm.level.next) {
      para(`Gap to ${sm.level.next.name} (${sm.level.next.scoreMin}): needs a section average of ${sm.level.next.avgNeeded}.`, { bold: true, keep: 40 });
      for (const g of sm.gap) para(`- ${SEC_LABEL[g.section] ?? g.section}: ${g.scaled}${g.gap > 0 ? ` (+${g.gap} needed)` : " (on target)"}`, { indent: 8, color: GRAY });
    }
    if (sm.priorities.length) {
      para(`Top ${sm.priorities.length} priorities`, { bold: true, keep: 40 });
      sm.priorities.forEach((p, k) => para(`${k + 1}. ${p.label} (${p.score}%, ${p.correct}/${p.total}, about ${p.recoverable} questions to win back). ${p.tip}`, { indent: 8, color: GRAY }));
    }
    para("Recommended next steps (about 20 minutes a day)", { bold: true, keep: 40 });
    for (const x of sm.plan) para(`${x.when} - ${x.focus}: ${x.action}`, { indent: 8, color: GRAY });
  }

  // Skor per section
  heading("Score per section");
  ensure(70);
  d.sections.forEach((s, i) => {
    const x = X + i * 169.5;
    doc.roundedRect(x, y, 160, 62, 10).fillAndStroke("#F5F7FA", LINE);
    doc.fillColor(GRAY).font("Regular").fontSize(9).text(SEC_LABEL[s.section] ?? s.section, x + 12, y + 10, { width: 136 });
    doc.fillColor(NAVY).font("Bold").fontSize(22).text(d.partial ? `${s.total ? Math.round((s.raw / s.total) * 100) : 0}%` : String(s.scaled), x + 12, y + 24);
    doc.fillColor(GRAY).font("Regular").fontSize(8.5).text(d.partial ? `${s.raw} of ${s.total} correct` : `${s.raw} of ${s.total} correct · scale 31-68`, x + 12, y + 49, { width: 140 });
  });
  y += 62 + 10;

  // Radar profil skor (skala section 31-68): skor ini dan, bila ada, target level berikutnya.
  const keys = ["listening", "structure", "reading"], vals = keys.map((k) => d.sections.find((x) => x.section === k)?.scaled);
  if (vals.every((v) => v != null)) {
    const tgt = d.summary?.level.next?.avgNeeded ?? null;
    ensure(200);
    const cx = X + 110, cy = y + 100, R = 70;
    const at = (i: number, v: number): [number, number] => { const a = (-90 + 120 * i) * (Math.PI / 180), r = ((Math.max(31, Math.min(68, v)) - 31) / 37) * R; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const poly = (vs: number[]) => vs.map((v, i) => at(i, v));
    for (const ring of [40, 50, 60]) doc.polygon(...poly([ring, ring, ring])).lineWidth(0.6).strokeColor(LINE).stroke();
    keys.forEach((k, i) => { const [ex, ey] = at(i, 68); doc.moveTo(cx, cy).lineTo(ex, ey).lineWidth(0.6).strokeColor(LINE).stroke(); const [lx, ly] = at(i, 76); doc.font("Bold").fontSize(8.5).fillColor(NAVY).text(SEC_LABEL[k], lx - 40, ly - 4, { width: 80, align: "center" }); });
    if (tgt != null) doc.polygon(...poly([tgt, tgt, tgt])).lineWidth(1.2).dash(4, { space: 3 }).strokeColor("#D9A02F").stroke().undash();
    doc.polygon(...poly(vals as number[])).fillOpacity(0.2).fillAndStroke(BLUE, BLUE).fillOpacity(1);
    doc.font("Bold").fontSize(11).fillColor(NAVY).text("Score profile", X + 250, y + 40, { width: W - 250 });
    doc.font("Regular").fontSize(9).fillColor(GRAY).text(`Blue: this test (${(vals as number[]).join(" / ")})`, X + 250, y + 60, { width: W - 250 });
    if (tgt != null) doc.text(`Dashed: section average ${tgt} needed for ${d.summary!.level.next!.name}`, X + 250, doc.y + 4, { width: W - 250 });
    doc.text("Scale 31-68 per section. Closer to the outer edge is better.", X + 250, doc.y + 4, { width: W - 250 });
    y += 205;
  }

  // Rincian per jenis soal, per section (terlemah dulu). Bagian (Part A/B/C) ditampilkan terpisah.
  const groups = buildBreakdown(d.topics);
  if (groups.length) {
    heading("Breakdown by question type");
    for (const g of groups) {
      ensure(40);
      doc.font("Bold").fontSize(10).fillColor(NAVY).text(g.label, X, y, { width: W }); y = doc.y + 2;
      if (g.parts.length) para(`By part: ${g.parts.map((p) => `${partLabel(p.topic)} ${p.correct}/${p.total}`).join(" · ")}`, { size: 8.5, color: GRAY });
      for (const t of g.rows.slice(0, 6)) {
        ensure(20);
        doc.font("Regular").fontSize(9.5).fillColor(NAVY).text(`${t.topic}${t.few ? " (few questions)" : ""}`, X, y, { width: 280 });
        doc.roundedRect(X + 290, y + 3, 130, 7, 3.5).fill(LINE);
        doc.roundedRect(X + 290, y + 3, Math.max(2, 1.3 * Math.max(0, Math.min(100, t.score))), 7, 3.5).fill(BLUE);
        doc.fillColor(GRAY).fontSize(9).text(`${Math.round(t.score)}% · ${t.correct}/${t.total}`, X + 428, y, { width: 71, align: "right" });
        y += 19;
      }
      if (g.rows.length > 6) para(`+ ${g.rows.length - 6} more question types, all listed in the app`, { size: 8, color: GRAY });
      y += 4;
    }
  }

  // Diagnostic (analisis AI)
  heading("Diagnostic: AI analysis summary");
  const a = d.analysis;
  if (a.status !== "ready") para(a.status === "failed" ? (a.error ?? "The analysis is not available yet.") : "The analysis is still being prepared. Export again in a few minutes to include it.", { color: GRAY });
  else {
    if (a.summary) para(a.summary);
    const extra = a.narrative ? (a.summary && a.narrative.startsWith(a.summary) ? a.narrative.slice(a.summary.length).trim() : a.narrative) : "";
    if (extra) para(extra, { color: GRAY });
    if (a.strengths?.length) { y += 4; para("Already strong", { bold: true, size: 10.5, keep: 60 }); for (const s of a.strengths) para(`- ${s.topic}: ${s.evidence}`, { indent: 8, color: GRAY }); }
    if (a.weaknesses?.length) { y += 4; para("Needs strengthening", { bold: true, size: 10.5, keep: 60 }); for (const w of a.weaknesses) para(`- ${w.title}: ${w.detail}`, { indent: 8, color: GRAY }); }
    if (a.nextSteps?.length) { y += 4; para("Next steps", { bold: true, size: 10.5, keep: 60 }); a.nextSteps.forEach((s, i) => para(`${i + 1}. ${s}`, { indent: 8, color: GRAY })); }
  }

  if (d.courseProgress?.length) {
    heading("Course progress by part");
    for (const r of d.courseProgress) {
      const parts = [`units ${r.unitsDone}/${r.unitsTotal}`];
      if (r.quizAvg != null) parts.push(`quiz average ${r.quizAvg}% (${r.quizzesTaken}/${r.quizzesTotal} quizzes taken)`);
      if (r.sectionTest) parts.push(`section test ${r.sectionTest.best}%${r.sectionTest.passed ? " (passed)" : " (not passed yet)"}`);
      else if (r.hasSectionTest) parts.push("section test not taken yet");
      para(`${r.part ? PART_NAMES[r.part] ?? r.title : r.title}: ${parts.join(" · ")}`, { indent: 8, color: GRAY });
    }
  }

  if (d.insights) {
    const i = d.insights, t = i.outcome.total;
    heading("How you answered");
    para(`${t.correct} correct · ${t.wrong} wrong · ${t.blank} blank`);
    if (i.stamina.length) para(`Accuracy start, middle, end: ${i.stamina.map((x) => `${SEC_LABEL[x.section] ?? x.section} ${x.thirds.join("% / ")}%`).join(" · ")}`, { size: 9, color: GRAY });
    if (i.time) para(`Average time per question: ${i.time.sections.map((x) => `${SEC_LABEL[x.section] ?? x.section} ${x.avgSec}s`).join(" · ")}`, { size: 9, color: GRAY });
    if (i.changes) para(i.changes.changed === 0 ? "You did not change any answer." : `Changed answers: ${i.changes.changed} (${i.changes.toRight} became right, ${i.changes.toWrong} became wrong, ${i.changes.stillWrong} stayed wrong).`, { size: 9, color: GRAY });
    for (const a of i.advice) para(`- ${a}`, { indent: 8, color: GRAY });
  }

  if (d.unanswered) {
    const u = d.unanswered;
    heading("Unanswered questions");
    para(u.unanswered === 0 ? `All ${u.total} questions were answered.` : `${u.unanswered} of ${u.total} questions (${u.pct}%) were left blank and counted as wrong.`);
    if (u.unanswered > 0) {
      const rows = u.sections.filter((s) => s.unanswered > 0).map((s) => `${SEC_LABEL[s.section] ?? s.section} ${s.unanswered}/${s.total}${s.trailing >= 3 ? ` (last ${s.trailing} blank)` : ""}`);
      if (rows.length) para(`By section: ${rows.join(" · ")}`, { size: 9, color: GRAY });
      if (u.types.length) para(`By question type: ${u.types.map((t) => `${typeLabel(t.skill, t.topic)} ${t.unanswered}/${t.total}`).join(" · ")}`, { size: 9, color: GRAY });
    }
    for (const t of u.advice) para(`- ${t}`, { indent: 8, color: GRAY });
  }

  if (d.recommendations.length) {
    heading("Courses to take next");
    for (const r of d.recommendations.slice(0, 6)) para(`- ${r.course}, unit "${r.unit}" (${r.score}% in ${r.topic})`, { indent: 8, color: GRAY });
  }

  y += 10; ensure(30);
  doc.font("Regular").fontSize(8).fillColor(GRAY).text("An estimate from a simulation test, not an official score. Official scores only come from official EPTA tests run by an official organizer.", X, y, { width: W });
}

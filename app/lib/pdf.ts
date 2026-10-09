import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "node:path";

// Poppins untuk semua PDF (file sama dengan font aplikasi, disajikan dari public/fonts).
const FONT = (w: string) => path.join(process.cwd(), "public", "fonts", `poppins-${w}.ttf`);

const NAVY = "#0F2F5E", BLUE = "#1B5FB8", GRAY = "#4B5A70", LINE = "#DCE3ED";
const fmt = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function render(build: (doc: PDFKit.PDFDocument) => void | Promise<void>, opts: PDFKit.PDFDocumentOptions = {}) {
  return new Promise<Buffer>(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, ...opts });
    doc.registerFont("Regular", FONT("400")); doc.registerFont("Bold", FONT("700")); doc.font("Regular");
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try { await build(doc); doc.end(); } catch (e) { reject(e); }
  });
}

function brand(doc: PDFKit.PDFDocument) {
  doc.roundedRect(48, 44, 34, 34, 7).fill(NAVY);
  doc.image(path.join(process.cwd(), "public", "brand", "logo-white.png"), 52, 54, { width: 26 });
  doc.fillColor(NAVY).font("Bold").fontSize(15).text("ENGLISH INSPIRA", 92, 53);
  doc.fillColor(GRAY).font("Regular").fontSize(8).text("by Inspira Teknologi", 92, 71);
}

export async function certificatePdf(c: {
  type: "itp" | "sim_report"; number: string; issuedAt: Date; name: string; verifyUrl: string;
  scores: { listening?: number | null; structure?: number | null; reading?: number | null; total?: number | null };
  title?: string; note?: string;
}) {
  const qr = await QRCode.toBuffer(c.verifyUrl, { margin: 1, width: 220 });
  return render((doc) => {
    doc.rect(24, 24, 547, 794).lineWidth(2).strokeColor(BLUE).stroke();
    brand(doc);
    doc.fillColor(BLUE).font("Bold").fontSize(10).text(c.type === "itp" ? "CERTIFICATE" : "TEST RESULT REPORT", 48, 140, { characterSpacing: 2 });
    doc.fillColor(NAVY).fontSize(24).text(c.type === "itp" ? "TOEFL ITP" : (c.title ?? "Simulation Test"), 48, 158, { width: 499 });
    doc.fillColor(GRAY).font("Regular").fontSize(11).text("Presented to", 48, 215);
    doc.fillColor(NAVY).font("Bold").fontSize(26).text(c.name.toUpperCase(), 48, 233, { width: 499 });

    const cols: [string, number | null | undefined][] = [["Listening", c.scores.listening], ["Structure & WE", c.scores.structure], ["Reading", c.scores.reading]];
    cols.forEach(([k, v], i) => {
      const x = 48 + i * 168;
      doc.roundedRect(x, 320, 156, 70, 10).fillAndStroke("#F5F7FA", LINE);
      doc.fillColor(GRAY).font("Regular").fontSize(9).text(k, x + 12, 332).fillColor(NAVY).font("Bold").fontSize(24).text(String(v ?? "-"), x + 12, 348);
    });
    doc.fillColor(GRAY).font("Regular").fontSize(11).text(c.type === "itp" ? "Total score" : "Estimated total score", 48, 420);
    doc.fillColor(BLUE).font("Bold").fontSize(46).text(String(c.scores.total ?? "-"), 48, 438);

    doc.image(qr, 400, 560, { width: 140 });
    doc.fillColor(GRAY).font("Regular").fontSize(9).text("Scan to verify", 400, 704, { width: 140, align: "center" });
    doc.fontSize(10).text(`Number: ${c.number}`, 48, 580).text(`Issued on: ${fmt(c.issuedAt)}`, 48, 596);
    doc.fontSize(8.5).text(c.note ?? (c.type === "sim_report"
      ? "This report is proof of practice from a simulation test, not an official TOEFL certificate. The score is an estimate."
      : "Official score from the test organizer. Verify authenticity via the link or QR code."), 48, 640, { width: 320 });
  });
}

type ReportData = {
  institution: { name: string; batch: string | null; contractEnd: Date | null; seats: number };
  registered: number; active: number; invited: number; placementDone: number; placementPct: number | null;
  levels: { label: string; n: number }[]; avgEstimate: number | null; avgDelta: number | null; reachedPct: number | null; reached: number; withScore: number;
  coaching: { sessionsMarked: number; presentPct: number | null; absent: number; quotaUsedPct: number | null };
  planLate: number; commonWeaknesses: { title: string; n: number }[]; attention: { name: string; reason: string }[];
};

/** Laporan kelompok institusi (PDF). Agregat saja: tidak memuat analisis AI, percakapan, atau catatan sesi per orang. */
export function institutionReportPdf(d: ReportData) {
  return render((doc) => {
    brand(doc);
    doc.fillColor(NAVY).font("Bold").fontSize(20).text("Group Report", 48, 110);
    doc.fillColor(GRAY).font("Regular").fontSize(10).text(`${d.institution.name}${d.institution.batch ? ` · ${d.institution.batch}` : ""}`, 48, 138)
      .text(`Created ${fmt(new Date())}${d.institution.contractEnd ? ` · contract until ${fmt(d.institution.contractEnd)}` : ""}`, 48, 152);
    let y = 185;
    const row = (k: string, v: string) => { doc.font("Regular").fontSize(10.5).fillColor(GRAY).text(k, 48, y, { width: 300 }); doc.font("Bold").fillColor(NAVY).text(v, 350, y, { width: 197, align: "right" }); y += 20; };
    const head = (t: string) => { y += 8; doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke(); y += 10; doc.font("Bold").fontSize(12).fillColor(NAVY).text(t, 48, y); y += 22; };
    head("Participants");
    row("Registered / seats", `${d.registered} / ${d.institution.seats}`); row("Active · awaiting activation", `${d.active} · ${d.invited}`);
    row("Placement completed", d.placementPct != null ? `${d.placementDone} (${d.placementPct}%)` : "-");
    head("Results");
    row("Average estimated score", d.avgEstimate != null ? String(d.avgEstimate) : "-"); row("Change since the first test", d.avgDelta != null ? `${d.avgDelta >= 0 ? "+" : ""}${d.avgDelta}` : "-");
    row("Mencapai target", d.reachedPct != null ? `${d.reachedPct}% (${d.reached} of ${d.withScore})` : "-");
    for (const l of d.levels) row(`Level ${l.label}`, `${l.n} participants`);
    head("Coaching & kepatuhan");
    row("Sessions recorded · absent", `${d.coaching.sessionsMarked} · ${d.coaching.absent}`); row("Attendance rate", d.coaching.presentPct != null ? `${d.coaching.presentPct}%` : "-");
    row("Quota used", d.coaching.quotaUsedPct != null ? `${d.coaching.quotaUsedPct}%` : "-"); row("Participants with overdue plans", String(d.planLate));
    head("Most common weak topics");
    if (!d.commonWeaknesses.length) row("No data yet", "");
    for (const w of d.commonWeaknesses) row(w.title, `${w.n} participants`);
    if (d.attention.length) {
      head("Needs attention");
      doc.font("Regular").fontSize(9.5).fillColor(GRAY);
      for (const a of d.attention.slice(0, 15)) { if (y > 760) { doc.addPage(); y = 60; } doc.text(`- ${a.name}: ${a.reason}`, 48, y, { width: 499 }); y += 15; }
    }
    doc.font("Regular").fontSize(8).fillColor(GRAY).text("Numbers are estimates from simulation tests, not official scores. This report contains group aggregates only.", 48, 800, { width: 499 });
  });
}

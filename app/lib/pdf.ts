import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const NAVY = "#0F2F5E", BLUE = "#1B5FB8", GRAY = "#4B5A70", LINE = "#DCE3ED";
const fmt = (d: Date | string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function render(build: (doc: PDFKit.PDFDocument) => void | Promise<void>, opts: PDFKit.PDFDocumentOptions = {}) {
  return new Promise<Buffer>(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, ...opts });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try { await build(doc); doc.end(); } catch (e) { reject(e); }
  });
}

function brand(doc: PDFKit.PDFDocument) {
  doc.roundedRect(48, 44, 34, 34, 7).fill(NAVY);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(13).text("EP", 48, 55, { width: 34, align: "center" });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text("EDULYFE EPTA", 92, 53);
  doc.fillColor(GRAY).font("Helvetica").fontSize(8).text("English Proficiency Test & Analytics", 92, 71);
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
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(10).text(c.type === "itp" ? "SERTIFIKAT" : "LAPORAN HASIL TES", 48, 140, { characterSpacing: 2 });
    doc.fillColor(NAVY).fontSize(24).text(c.type === "itp" ? "TOEFL ITP" : (c.title ?? "Tes Simulasi"), 48, 158, { width: 499 });
    doc.fillColor(GRAY).font("Helvetica").fontSize(11).text("Diberikan kepada", 48, 215);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(c.name.toUpperCase(), 48, 233, { width: 499 });

    const cols: [string, number | null | undefined][] = [["Listening", c.scores.listening], ["Structure & WE", c.scores.structure], ["Reading", c.scores.reading]];
    cols.forEach(([k, v], i) => {
      const x = 48 + i * 168;
      doc.roundedRect(x, 320, 156, 70, 10).fillAndStroke("#F5F7FA", LINE);
      doc.fillColor(GRAY).font("Helvetica").fontSize(9).text(k, x + 12, 332).fillColor(NAVY).font("Helvetica-Bold").fontSize(24).text(String(v ?? "-"), x + 12, 348);
    });
    doc.fillColor(GRAY).font("Helvetica").fontSize(11).text(c.type === "itp" ? "Skor total" : "Estimasi skor total", 48, 420);
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(46).text(String(c.scores.total ?? "-"), 48, 438);

    doc.image(qr, 400, 560, { width: 140 });
    doc.fillColor(GRAY).font("Helvetica").fontSize(9).text("Pindai untuk verifikasi", 400, 704, { width: 140, align: "center" });
    doc.fontSize(10).text(`Nomor: ${c.number}`, 48, 580).text(`Tanggal terbit: ${fmt(c.issuedAt)}`, 48, 596);
    doc.fontSize(8.5).text(c.note ?? (c.type === "sim_report"
      ? "Laporan ini adalah bukti latihan dari tes simulasi, bukan sertifikat TOEFL resmi. Skor adalah estimasi."
      : "Skor resmi dari penyelenggara tes. Verifikasi keaslian melalui tautan atau QR."), 48, 640, { width: 320 });
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
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(20).text("Laporan Kelompok", 48, 110);
    doc.fillColor(GRAY).font("Helvetica").fontSize(10).text(`${d.institution.name}${d.institution.batch ? ` · ${d.institution.batch}` : ""}`, 48, 138)
      .text(`Dibuat ${fmt(new Date())}${d.institution.contractEnd ? ` · kontrak sampai ${fmt(d.institution.contractEnd)}` : ""}`, 48, 152);
    let y = 185;
    const row = (k: string, v: string) => { doc.font("Helvetica").fontSize(10.5).fillColor(GRAY).text(k, 48, y, { width: 300 }); doc.font("Helvetica-Bold").fillColor(NAVY).text(v, 350, y, { width: 197, align: "right" }); y += 20; };
    const head = (t: string) => { y += 8; doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke(); y += 10; doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text(t, 48, y); y += 22; };
    head("Peserta");
    row("Terdaftar / kursi", `${d.registered} / ${d.institution.seats}`); row("Aktif · menunggu aktivasi", `${d.active} · ${d.invited}`);
    row("Placement selesai", d.placementPct != null ? `${d.placementDone} (${d.placementPct}%)` : "-");
    head("Hasil");
    row("Rata-rata estimasi skor", d.avgEstimate != null ? String(d.avgEstimate) : "-"); row("Perubahan dari tes pertama", d.avgDelta != null ? `${d.avgDelta >= 0 ? "+" : ""}${d.avgDelta}` : "-");
    row("Mencapai target", d.reachedPct != null ? `${d.reachedPct}% (${d.reached} dari ${d.withScore})` : "-");
    for (const l of d.levels) row(`Level ${l.label}`, `${l.n} peserta`);
    head("Coaching & kepatuhan");
    row("Sesi tercatat · tidak hadir", `${d.coaching.sessionsMarked} · ${d.coaching.absent}`); row("Tingkat kehadiran", d.coaching.presentPct != null ? `${d.coaching.presentPct}%` : "-");
    row("Kuota terpakai", d.coaching.quotaUsedPct != null ? `${d.coaching.quotaUsedPct}%` : "-"); row("Peserta dengan rencana terlambat", String(d.planLate));
    head("Topik yang paling banyak lemah");
    if (!d.commonWeaknesses.length) row("Belum ada data", "");
    for (const w of d.commonWeaknesses) row(w.title, `${w.n} peserta`);
    if (d.attention.length) {
      head("Perlu perhatian");
      doc.font("Helvetica").fontSize(9.5).fillColor(GRAY);
      for (const a of d.attention.slice(0, 15)) { if (y > 760) { doc.addPage(); y = 60; } doc.text(`- ${a.name}: ${a.reason}`, 48, y, { width: 499 }); y += 15; }
    }
    doc.font("Helvetica").fontSize(8).fillColor(GRAY).text("Angka adalah estimasi dari tes simulasi, bukan skor resmi. Laporan ini hanya berisi agregat kelompok.", 48, 800, { width: 499 });
  });
}

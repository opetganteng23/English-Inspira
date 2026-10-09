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

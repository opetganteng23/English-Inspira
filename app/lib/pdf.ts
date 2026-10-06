import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const NAVY = "#0F2F5E", BLUE = "#1B5FB8", GRAY = "#4B5A70", LINE = "#DCE3ED";
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
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

export function invoicePdf(o: {
  invoiceNo: string; status: string; paidAt?: Date | null; createdAt: Date; buyer: { name?: string | null; email?: string | null };
  items: { name: string; price: number }[]; subtotal: number; upgradeCredit: number; discount: number; voucherCode?: string | null; total: number; paymentType?: string | null;
}) {
  return render((doc) => {
    brand(doc);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(22).text("INVOICE", 48, 110);
    doc.fillColor(GRAY).font("Helvetica").fontSize(10)
      .text(`No. ${o.invoiceNo}`, 48, 140).text(`Tanggal ${fmt(o.paidAt ?? o.createdAt)}`, 48, 154)
      .text(`Status: ${o.status === "paid" ? "LUNAS" : o.status.toUpperCase()}${o.paymentType ? ` (${o.paymentType})` : ""}`, 48, 168);
    doc.fillColor(NAVY).font("Helvetica-Bold").text("Ditagihkan kepada", 340, 140).font("Helvetica").fillColor(GRAY)
      .text(o.buyer.name ?? "-", 340, 154).text(o.buyer.email ?? "-", 340, 168);

    let y = 215;
    doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke();
    doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(9).text("PRODUK", 48, y + 8).text("HARGA", 440, y + 8, { width: 107, align: "right" });
    y += 28;
    doc.font("Helvetica").fontSize(11).fillColor(NAVY);
    for (const i of o.items) { doc.text(i.name, 48, y, { width: 380 }).text(rp(i.price), 440, y, { width: 107, align: "right" }); y += 22; }
    doc.moveTo(48, y).lineTo(547, y).strokeColor(LINE).stroke(); y += 12;
    const row = (k: string, v: string, bold = false) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 10.5).fillColor(bold ? NAVY : GRAY).text(k, 300, y, { width: 140 }).text(v, 440, y, { width: 107, align: "right" }); y += bold ? 24 : 18; };
    row("Subtotal", rp(o.subtotal));
    if (o.upgradeCredit) row("Potongan upgrade", "-" + rp(o.upgradeCredit));
    if (o.discount) row(`Voucher ${o.voucherCode ?? ""}`, "-" + rp(o.discount));
    row("Total", rp(o.total), true);
    doc.font("Helvetica").fontSize(8.5).fillColor(GRAY).text("Harga sudah termasuk pajak. Produk digital, akses terbuka otomatis setelah pembayaran dikonfirmasi.", 48, 740, { width: 499 });
  });
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

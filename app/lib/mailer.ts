import nodemailer from "nodemailer";

// Semua email lewat sendMail() agar mudah ganti SMTP. Tanpa kredensial (dev), email dicetak ke konsol.
const configured = !!(process.env.MAIL_USER && process.env.MAIL_APP_PASSWORD);

const transport = configured
  ? nodemailer.createTransport({
      host: process.env.MAIL_HOST ?? "smtp.gmail.com",
      port: Number(process.env.MAIL_PORT ?? 465),
      secure: (process.env.MAIL_SECURE ?? "true") === "true",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_APP_PASSWORD },
      pool: true,
      maxConnections: 3,
    })
  : null;

export async function sendMail(to: string, subject: string, html: string) {
  if (!transport) {
    console.log(`\n[mail:dev] to=${to}\nsubject=${subject}\n${html.replace(/<[^>]+>/g, " ")}\n`);
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
}

export const otpEmail = (code: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:420px">
  <h2 style="color:#0F2F5E">Kode masuk Edulyfe EPTA</h2>
  <p>Gunakan kode berikut. Berlaku 5 menit. Jangan bagikan kepada siapa pun.</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1B5FB8">${code}</p></div>`;

const esc = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]!);
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
const wrap = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:480px;color:#1C2B44"><h2 style="color:#0F2F5E">${esc(title)}</h2>${body}<p style="color:#4B5A70;font-size:12px;margin-top:24px">Edulyfe EPTA</p></div>`;

export const orderPaidEmail = (invoiceNo: string, total: number, items: string[]) =>
  wrap("Pembayaran berhasil", `<p>Invoice <b>${esc(invoiceNo)}</b> sebesar <b>${rp(total)}</b> sudah lunas.</p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul><p>Akses sudah terbuka di akunmu.</p>`);

export const itpRegisteredEmail = (name: string, title: string, date: string, place: string) =>
  wrap("Pendaftaran TOEFL ITP diterima", `<p>Halo ${esc(name)}, pendaftaranmu untuk <b>${esc(title)}</b> sudah kami terima.</p><p>Jadwal: ${esc(date)}<br>Tempat: ${esc(place)}</p><p>Datang 30 menit lebih awal dan bawa KTP/paspor asli.</p>`);

export const reminderEmail = (name: string, items: string[]) =>
  wrap("Rencana aksi mingguanmu", `<p>Halo ${esc(name)}, ini langkah dari Konselor AI yang belum selesai:</p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`);

export const inviteEmail = (institution: string, code: string, link: string) =>
  wrap(`Undangan dari ${institution}`, `<p>Kamu diundang ke program persiapan TOEFL ITP oleh <b>${esc(institution)}</b>.</p><p>Kode institusi: <b style="font-size:20px;letter-spacing:2px">${esc(code)}</b></p><p><a href="${esc(link)}">Daftar dan masukkan kode</a></p>`);

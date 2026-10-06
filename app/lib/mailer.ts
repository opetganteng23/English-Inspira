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

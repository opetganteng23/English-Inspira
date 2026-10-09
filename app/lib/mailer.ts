import nodemailer from "nodemailer";

// Transport SMTP (Gmail App Password). Panggil lewat antrean (lib/mailq.ts), bukan langsung dari handler.
// Tanpa kredensial (dev), email dicetak ke konsol.
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

/** Bungkus tunggal pengiriman supaya mudah pindah SMTP lain tanpa mengubah kode lain. */
export async function sendMail(to: string, subject: string, html: string) {
  if (!transport) {
    const links = Array.from(html.matchAll(/href="([^"]+)"/g), (m) => m[1]).join(" ");
    console.log(`\n[mail:dev] to=${to}\nsubject=${subject}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}${links ? `\nlinks: ${links}` : ""}\n`);
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
}

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

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Versi teks biasa dari email HTML (tautan ditulis sebagai "label: alamat"), dikirim sebagai cadangan multipart. */
export function htmlToText(html: string) {
  return decode(
    html
      .replace(/<link[^>]*>/gi, "")
      .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, h: string, t: string) => `${t.replace(/<[^>]+>/g, "").trim()}: ${h}`)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h2|div|tr|li)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Bungkus tunggal pengiriman supaya mudah pindah SMTP lain tanpa mengubah kode lain. */
export async function sendMail(to: string, subject: string, html: string) {
  if (!transport) {
    const links = Array.from(html.matchAll(/href="([^"]+)"/g), (m) => m[1]).join(" ");
    console.log(`\n[mail:dev] to=${to}\nsubject=${subject}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}${links ? `\nlinks: ${links}` : ""}\n`);
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text: htmlToText(html) });
}

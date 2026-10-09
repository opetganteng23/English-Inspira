// Template email (MTS §7). Semua data yang ditampilkan di-escape.
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const wrap = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:480px;color:#1C2B44"><h2 style="color:#0F2F5E">${esc(title)}</h2>${body}<p style="color:#4B5A70;font-size:12px;margin-top:24px">Edulyfe EPTA</p></div>`;
const btn = (href: string, label: string) => `<p><a href="${esc(href)}" style="display:inline-block;background:#1B5FB8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`;
const fmt = (d: unknown) => new Date(String(d)).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" });

type D = Record<string, unknown>;
export const TEMPLATES = {
  otp: (d: D) => ({ subject: "Kode masuk Edulyfe EPTA", html: wrap("Kode masuk", `<p>Gunakan kode berikut. Berlaku 5 menit. Jangan bagikan kepada siapa pun.</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1B5FB8">${esc(d.code)}</p>`) }),
  invitation: (d: D) => ({ subject: `Undangan program persiapan TOEFL ITP dari ${d.institution}`, html: wrap(`Undangan dari ${d.institution}`, `<p>Halo${d.name ? ` ${esc(d.name)}` : ""}, kamu diundang mengikuti program persiapan TOEFL ITP oleh <b>${esc(d.institution)}</b>.</p><p>Masuk memakai email ini; kami kirim kode 6 digit ke emailmu. Tautan berlaku sampai ${esc(fmt(d.expiresAt))}.</p>${btn(String(d.link), "Mulai")}`) }),
  placement_result: (d: D) => ({ subject: "Hasil placement test kamu", html: wrap("Hasil placement", `<p>Estimasi skormu <b>${esc(d.score)}</b>, level <b>${esc(d.level)}</b>. Kuota coaching: <b>${esc(d.quota)}</b> sesi.</p><p>Analisis hasilmu dan rencana belajar dari topik yang perlu diperkuat tersedia di aplikasi.</p>${btn(String(d.link), "Lihat hasil")}`) }),
  analysis_ready: (d: D) => ({ subject: "Analisis hasil belajarmu sudah siap", html: wrap("Analisis siap", `<p>Analisis untuk <b>${esc(d.title)}</b> sudah siap, lengkap dengan narasi dan saran langkah berikutnya.</p>${btn(String(d.link), "Buka analisis")}`) }),
  itp_registered: (d: D) => ({ subject: "Pendaftaran TOEFL ITP diterima", html: wrap("Pendaftaran diterima", `<p>Halo ${esc(d.name)}, pendaftaranmu untuk <b>${esc(d.title)}</b> sudah kami terima.</p><p>Jadwal: ${esc(fmt(d.date))}<br>Tempat: ${esc(d.place)}</p><p>Datang 30 menit lebih awal dan bawa KTP/paspor asli.</p>`) }),
  booking_confirmed: (d: D) => ({ subject: "Booking coaching terkonfirmasi", html: wrap("Booking terkonfirmasi", `<p>Sesi coaching bersama <b>${esc(d.coach)}</b>: ${esc(fmt(d.startsAt))}.</p><p>${d.mode === "online" ? `Link: ${esc(d.meetingUrl)}` : `Ruangan: ${esc(d.room)}`}</p>`) }),
  slot_changed: (d: D) => ({ subject: "Jadwal coaching berubah", html: wrap("Jadwal berubah", `<p>Sesi coaching kamu diubah coach menjadi ${esc(fmt(d.startsAt))}. Jika tidak cocok, batalkan dan pilih slot lain; kuotamu tidak berkurang.</p>${btn(String(d.link), "Lihat jadwal")}`) }),
  slot_cancelled: (d: D) => ({ subject: "Sesi coaching dibatalkan coach", html: wrap("Sesi dibatalkan", `<p>Sesi ${esc(fmt(d.startsAt))} dibatalkan oleh coach. <b>Kuotamu tidak berkurang.</b> Silakan pilih slot pengganti.</p>${btn(String(d.link), "Pilih slot")}`) }),
  session_reminder: (d: D) => ({ subject: "Pengingat sesi coaching besok", html: wrap("Pengingat sesi", `<p>Sesi coaching kamu: ${esc(fmt(d.startsAt))}.</p><p>${d.mode === "online" ? `Link: ${esc(d.meetingUrl)}` : `Ruangan: ${esc(d.room)}`}</p>`) }),
  plan_deadline: (d: D) => ({ subject: "Deadline rencana belajarmu mendekat", html: wrap("Pengingat rencana belajar", `<p>Item berikut akan jatuh tempo:</p><ul>${((d.items as string[]) ?? []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>${btn(String(d.link), "Buka rencana")}`) }),
  quota_low: (d: D) => ({ subject: "Kuota coaching hampir habis", html: wrap("Kuota coaching", `<p>Sisa kuota coaching kamu: <b>${esc(d.left)}</b> sesi.</p>`) }),
} satisfies Record<string, (d: D) => { subject: string; html: string }>;

export type TemplateName = keyof typeof TEMPLATES;
export const render = (t: TemplateName, d: D) => TEMPLATES[t](d);

// Uji asap end-to-end (77 pemeriksaan). Server dev harus jalan di :3100 dengan DB in-memory (MONGODB_URI kosong).
// Pakai: jalankan "npm run dev -p 3100 > dev.log", lalu: LOG=dev.log node scripts/smoke.mjs
﻿// Uji asap menyeluruh terhadap server dev (DB in-memory). Jalankan: LOG=<path log dev> node smoke.mjs
import fs from "node:fs";
const U = "http://localhost:3100", LOG = process.env.LOG;
let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { (c ? pass++ : fail++); console.log(`${c ? "PASS" : "FAIL"}  ${name}${!c && extra ? "  → " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(jar, path, { method = "GET", json, form, headers = {} } = {}) {
  const h = { ...headers };
  if (jar?.c) h.cookie = jar.c;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(U + path, { method, headers: h, body, redirect: "manual" });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (jar && sc.length) jar.c = sc.map((x) => x.split(";")[0]).join("; ");
  const ct = r.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await r.json().catch(() => ({})) : null;
  return { status: r.status, data, headers: r.headers, res: r };
}
async function login(email0, name = "Uji") {
  const email = email0.toLowerCase();
  const jar = { c: "" };
  await req(null, "/api/auth/request-otp", { method: "POST", json: { email } });
  let code;
  for (let i = 0; i < 20 && !code; i++) {
    await sleep(300);
    const log = fs.readFileSync(LOG, "utf8");
    const at = log.lastIndexOf(`to=${email}`);
    if (at >= 0) code = (log.slice(at, at + 600).match(/\b\d{6}\b/) ?? [])[0];
  }
  const r = await req(jar, "/api/auth/verify-otp", { method: "POST", json: { email, code, name } });
  if (r.status !== 200) throw new Error(`login ${email} gagal: ${JSON.stringify(r.data)}`);
  return jar;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const png = () => { const f = new FormData(); f.append("file", new Blob([PNG], { type: "image/png" }), "x.png"); f.append("sensitive", "true"); return f; };

(async () => {
  console.log("== Setup ==");
  const admin = await login("admin@test.local", "Admin");
  ok((await req(null, "/api/dev/seed", { method: "POST" })).status === 200, "seed (trial+produk+demo)");

  console.log("\n== Admin: dashboard & CRUD ==");
  let r = await req(admin, "/api/admin/dashboard");
  ok(r.status === 200 && r.data.kpi, "dashboard", JSON.stringify(r.data));
  r = await req(admin, "/api/admin/products"); ok(r.status === 200 && r.data.products.length >= 4, "daftar produk");
  const sim = r.data.products.find((p) => p.slug === "sim-1"), itpP = r.data.products.find((p) => p.slug === "itp-only");
  r = await req(admin, "/api/admin/vouchers", { method: "POST", json: { code: "uji50", type: "fixed", value: 50000 } });
  ok(r.status === 201, "voucher dibuat (kode di-uppercase)", JSON.stringify(r.data));
  r = await req(admin, "/api/admin/vouchers", { method: "POST", json: { code: "UJI50", type: "fixed", value: 1 } }); ok(r.status === 409, "voucher duplikat ditolak");
  r = await req(admin, "/api/admin/vouchers", { method: "POST", json: { code: "BIG", type: "percent", value: 150 } }); ok(r.status === 400, "persen >100 ditolak");
  r = await req(admin, "/api/admin/settings/general", { method: "PUT", json: { siteName: "Edulyfe EPTA", supportEmail: "bantuan@edulyfe.test", supportWhatsapp: "6281234567890", itpOrganizer: "Mitra Uji", refundPolicy: "", rescheduleDays: 7, idRetentionDays: 365 } });
  ok(r.status === 200, "pengaturan umum disimpan");

  console.log("\n== Materi ==");
  r = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Uji Rich", kind: "rich", contentHtml: '<p onclick="x()">Halo <b>dunia</b></p><script>alert(1)</script><img src="http://evil/x.png"><a href="javascript:alert(1)">x</a><audio data-audio-id="aaaaaaaaaaaaaaaaaaaaaaaa"></audio>', access: "paid" } });
  ok(r.status === 201, "materi rich dibuat"); const mid = r.data.id, mslug = r.data.slug;
  r = await req(admin, `/api/admin/materials/${mid}`); const html = r.data.contentHtml;
  ok(html && !/onclick|<script|evil|javascript:/i.test(html), "sanitasi rich text saat simpan", html);
  r = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Uji HTML", kind: "html", htmlDoc: { html: "<button id=b>ok</button>", js: "document.getElementById('b').onclick=function(){EI.progress(80,[1])}" } } });
  ok(r.status === 201, "materi HTML dibuat"); const hid = r.data.id, hslug = r.data.slug;
  r = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Besar", kind: "html", htmlDoc: { html: "x".repeat(2.2 * 1024 * 1024) } } }); ok(r.status === 413 || r.status === 400, "dokumen >2MB ditolak", r.status);
  for (const id of [mid, hid]) await req(admin, `/api/admin/materials/${id}/publish`, { method: "POST", json: { action: "publish" } });
  r = await req(admin, `/api/admin/materials/${hid}/publish`); ok(r.data.versions?.length === 1, "versi tersimpan saat publish");

  console.log("\n== Peserta: belanja, materi, ITP ==");
  const budi = await login("budi@test.local", "Budi Santoso");
  r = await req(budi, "/api/materials"); const list = r.data.materials;
  ok(list.length >= 4 && list.find((m) => m.slug === mslug).locked === true, "materi berbayar terkunci tanpa paket");
  r = await req(budi, `/api/materials/${mslug}`); ok(r.status === 402, "baca materi berbayar tanpa akses = 402");
  r = await req(budi, "/api/materials/subject-verb-agreement"); ok(r.status === 200 && r.data.contentHtml.includes("results"), "materi gratis terbuka");
  // beli Journey (punya materi + ITP)
  const jr = await req(budi, "/api/products"); const journey = jr.data.products.find((p) => p.slug === "journey-6m");
  r = await req(budi, "/api/checkout", { method: "POST", json: { productIds: [journey.id], agree: true, buyer: { name: "Budi", email: "budi@test.local" } } });
  ok(r.status === 200 && r.data.mock, "checkout journey (simulasi)", JSON.stringify(r.data));
  r = await req(budi, `/api/dev/pay/${r.data.orderId}`, { method: "POST", json: { result: "paid" } }); ok(r.status === 200, "bayar simulasi");
  r = await req(budi, "/api/me/access"); ok(r.data.materials && r.data.itp === 1 && r.data.tests.diagnostic === 4, "entitlement journey: materi, ITP×1, diagnostic×4", JSON.stringify(r.data));
  r = await req(budi, `/api/materials/${hslug}`);
  ok(r.status === 200 && r.data.htmlDoc.html.includes("button"), "materi HTML terbuka setelah beli");
  r = await req(budi, `/api/materials/${hslug}/progress`, { method: "POST", json: { score: 80, answers: [1] } }); ok(r.status === 200 && r.data.attempts === 1, "progres tersimpan");
  r = await req(budi, `/api/materials/${hslug}/progress`, { method: "POST", json: { score: 999 } }); ok(r.status === 400, "skor di luar 0–100 ditolak");
  r = await req(budi, "/api/journey"); ok(r.data.steps.length === 10 && r.data.hasJourney, "journey 10 langkah");
  // tes diagnostic belum ada tes -> daftar kosong untuk kind itu; ITP:
  const s = await req(admin, "/api/admin/itp-sessions"); const sess = s.data.sessions.find((x) => x.status === "open");
  ok(!!sess, "ada sesi ITP demo");
  r = await req(budi, "/api/itp/sessions"); ok(r.status === 200 && r.data.itpRemaining === 1 && r.data.sessions.length >= 1, "sesi ITP terlihat peserta");
  r = await req(budi, "/api/assets", { method: "POST", form: png() }); ok(r.status === 201, "unggah KTP (sensitif)"); const idA = r.data.id;
  r = await req(budi, "/api/assets", { method: "POST", form: png() }); const faceA = r.data.id;
  r = await req(null, `/api/assets/${idA}`); ok(r.status === 401, "KTP tanpa login ditolak");
  const evil = await login("evil@test.local", "Evil");
  r = await req(evil, `/api/assets/${idA}`); ok(r.status === 403, "KTP milik orang lain ditolak");
  r = await req(admin, `/api/assets/${idA}`); ok(r.status === 200, "admin boleh buka KTP (dicatat audit)");
  const reg = { sessionId: sess.id, fullName: "Budi Santoso", nik: "3201010101010001", birthDate: "2000-05-01", gender: "L", idPhotoAssetId: idA, facePhotoAssetId: faceA, agree: true };
  r = await req(budi, "/api/itp/registrations", { method: "POST", json: { ...reg, nik: "123" } }); ok(r.status === 400, "NIK tidak valid ditolak");
  r = await req(evil, "/api/itp/registrations", { method: "POST", json: reg }); ok(r.status === 400 || r.status === 403, "foto dokumen orang lain / tanpa jatah ITP ditolak", r.status);
  r = await req(budi, "/api/itp/registrations", { method: "POST", json: reg }); ok(r.status === 201, "pendaftaran ITP", JSON.stringify(r.data)); const regId = r.data.id;
  r = await req(budi, "/api/itp/registrations", { method: "POST", json: reg }); ok(r.status === 409 || r.status === 403, "daftar ganda ditolak", r.status);
  r = await req(budi, "/api/me", { method: "PATCH", json: { name: "Nama Lain" } }); ok(r.status === 409, "nama terkunci setelah daftar ITP");

  console.log("\n== Admin ITP: roster, dokumen, skor, sertifikat ==");
  r = await req(admin, `/api/admin/itp-sessions/${sess.id}/roster`);
  ok(r.data.roster.length === 1 && r.data.roster[0].nikLast4 === "0001" && !JSON.stringify(r.data).includes("3201010101010001"), "roster hanya menampilkan 4 digit NIK");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`); ok(r.data.nik === "3201010101010001", "NIK terdekripsi untuk admin (audit)");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PATCH", json: { docStatus: "rejected" } }); ok(r.status === 400, "tolak dokumen tanpa alasan ditolak");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PATCH", json: { docStatus: "valid" } }); ok(r.data.status === "confirmed", "dokumen valid → terkonfirmasi");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PUT", json: { listening: 99, structure: 50, reading: 50 } }); ok(r.status === 400, "skor di luar 31–68 ditolak");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PUT", json: { listening: 50, structure: 52, reading: 51 } });
  ok(r.status === 200 && r.data.total === 510 && /^EPTA-ITP-\d{4}-\d{4}$/.test(r.data.certificateNumber), "skor resmi → total 510 + nomor sertifikat", JSON.stringify(r.data));
  const certNo = r.data.certificateNumber;
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PUT", json: { listening: 50, structure: 52, reading: 51 } });
  r = await req(budi, "/api/certificates"); ok(r.data.certificates.filter((c) => c.type === "itp").length === 1, "sertifikat tidak dobel saat skor disimpan ulang");
  const certId = r.data.certificates.find((c) => c.type === "itp").id;
  r = await req(budi, `/api/certificates/${certId}/pdf`); const pdf = Buffer.from(await r.res.arrayBuffer());
  ok(r.status === 200 && r.headers.get("content-type") === "application/pdf" && pdf.subarray(0, 4).toString() === "%PDF", "PDF sertifikat valid", r.status);
  r = await req(evil, `/api/certificates/${certId}/pdf`); ok(r.status === 404, "PDF sertifikat orang lain 404");
  r = await req(null, `/api/certificates/verify/${certNo}`); ok(r.status === 200 && r.data.valid && r.data.total === 510 && r.data.holder && !JSON.stringify(r.data).includes("Budi Santoso"), "verifikasi publik: nama disamarkan", JSON.stringify(r.data));
  r = await req(null, "/api/certificates/verify/EPTA-ITP-2026-9999"); ok(r.status === 404, "nomor palsu 404");
  r = await req(admin, `/api/admin/itp-sessions/${sess.id}/export.xlsx`); const x = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && x.subarray(0, 2).toString() === "PK", "ekspor roster .xlsx");
  r = await req(budi, "/api/orders"); const o1 = r.data.orders[0];
  r = await req(budi, `/api/orders/${o1.id}/invoice.pdf`); const ipdf = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && ipdf.subarray(0, 4).toString() === "%PDF", "PDF invoice valid");

  console.log("\n== Institusi: isolasi data (C10) ==");
  const mk = async (name, code) => (await req(admin, "/api/admin/institutions", { method: "POST", json: { name, code, seats: 2 } })).data.id;
  const iA = await mk("Kampus A", "KAMPUSA"), iB = await mk("Kampus B", "KAMPUSB");
  await req(admin, "/api/admin/users", { method: "POST", json: { email: "adminA@test.local", role: "inst_admin", institutionId: iA } });
  await req(admin, "/api/admin/users", { method: "POST", json: { email: "adminB@test.local", role: "inst_admin", institutionId: iB } });
  const pa = await login("pa@test.local", "Peserta A"), pb = await login("pb@test.local", "Peserta B"), pc = await login("pc@test.local", "Peserta C");
  r = await req(pa, "/api/institution/redeem", { method: "POST", json: { code: "kampusa" } }); ok(r.status === 200, "redeem kode (case-insensitive)");
  r = await req(pb, "/api/institution/redeem", { method: "POST", json: { code: "KAMPUSB" } }); ok(r.status === 200, "redeem kampus B");
  r = await req(pa, "/api/institution/redeem", { method: "POST", json: { code: "KAMPUSB" } }); ok(r.status === 409, "sudah tergabung institusi lain ditolak");
  const p2 = await login("pa2@test.local", "A Dua"), p3 = await login("pa3@test.local", "A Tiga");
  await req(p2, "/api/institution/redeem", { method: "POST", json: { code: "KAMPUSA" } });
  r = await req(p3, "/api/institution/redeem", { method: "POST", json: { code: "KAMPUSA" } }); ok(r.status === 409, "kursi penuh ditolak (seats=2)");
  const admA = await login("adminA@test.local", "Admin A");
  r = await req(admA, "/api/inst/participants"); const emailsA = r.data.participants.map((p) => p.email).sort();
  ok(JSON.stringify(emailsA) === JSON.stringify(["pa2@test.local", "pa@test.local"]), "inst_admin A hanya melihat pesertanya", JSON.stringify(emailsA));
  const pbId = (await req(admin, "/api/admin/participants?q=pb@test.local")).data.participants[0].id;
  r = await req(admA, `/api/inst/participants/${pbId}`); ok(r.status === 404, "inst_admin A membuka peserta B = 404");
  r = await req(admA, `/api/inst/participants?institution=${iB}`); ok(r.data.participants.every((p) => p.email !== "pb@test.local"), "parameter ?institution diabaikan untuk inst_admin");
  r = await req(admA, "/api/admin/dashboard"); ok(r.status === 403, "inst_admin tidak bisa API admin");
  r = await req(pa, "/api/inst/summary"); ok(r.status === 403, "peserta tidak bisa API institusi");
  r = await req(admA, "/api/inst/summary"); ok(r.status === 200 && r.data.registered === 2, "ringkasan institusi A");
  r = await req(admA, "/api/inst/report.xlsx"); const xr = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && xr.subarray(0, 2).toString() === "PK", "laporan Excel institusi");
  r = await req(admA, "/api/inst/invite", { method: "POST", json: { emails: ["a@x.com", "bukan-email"] } }); ok(r.status === 400, "undangan dengan email tidak valid ditolak");
  r = await req(admA, "/api/inst/invite", { method: "POST", json: { emails: ["a@x.com"] } }); ok(r.status === 200 && r.data.results[0].ok, "undangan terkirim");
  r = await req(admin, `/api/inst/summary?institution=${iB}`); ok(r.status === 200 && r.data.registered === 1, "admin melihat institusi pilihan via ?institution");

  console.log("\n== Admin: pengguna & refund ==");
  const adminId = (await req(admin, "/api/admin/users")).data.users.find((u) => u.email === "admin@test.local").id;
  r = await req(admin, `/api/admin/users/${adminId}`, { method: "PATCH", json: { role: "participant" } }); ok(r.status === 409, "admin tidak bisa menurunkan diri / admin terakhir");
  r = await req(admin, `/api/admin/orders/${o1.id}/refund`, { method: "POST", json: { reason: "x" } }); ok(r.status === 400, "refund tanpa alasan layak ditolak");
  r = await req(admin, `/api/admin/orders/${o1.id}/refund`, { method: "POST", json: { reason: "Uji refund" } }); ok(r.status === 200, "refund dicatat");
  r = await req(budi, "/api/me/access"); ok(r.data.materials === false && r.data.tests.diagnostic === undefined, "akses dari order refund dicabut", JSON.stringify(r.data));
  r = await req(admin, `/api/admin/orders/${o1.id}/refund`, { method: "POST", json: { reason: "ulang" } }); ok(r.status === 409, "refund ganda ditolak");

  console.log("\n== Keamanan umum ==");
  r = await req(budi, "/api/me", { method: "PATCH", json: { phone: "0812345678" }, headers: { origin: "https://evil.example" } }); ok(r.status === 403, "CSRF: Origin asing ditolak");
  r = await req(budi, "/api/me", { method: "PATCH", json: { phone: "0812345678" }, headers: { "sec-fetch-site": "cross-site" } }); ok(r.status === 403, "CSRF: sec-fetch-site cross-site ditolak");
  r = await req(null, "/api/midtrans/notification", { method: "POST", json: { order_id: "x", status_code: "200", gross_amount: "1.00", signature_key: "salah" } }); ok(r.status === 403, "webhook signature palsu ditolak");
  r = await req(null, "/masuk"); ok(r.headers.get("x-frame-options") === "DENY" && r.headers.get("x-content-type-options") === "nosniff", "header keamanan terpasang");
  r = await req(null, "/admin"); ok(r.status === 307, "halaman admin tanpa login dialihkan");
  r = await req(budi, "/admin"); ok(r.status === 307, "peserta dialihkan dari /admin");
  r = await req(budi, "/api/me/export"); const ex = r.data; ok(r.status === 200 && ex.user.email === "budi@test.local" && ex.itpRegistrations[0].nik === "3201010101010001", "ekspor data pribadi (NIK milik sendiri)");
  r = await req(budi, "/api/me/delete", { method: "POST", json: { confirm: "SALAH" } }); ok(r.status === 400, "hapus akun tanpa konfirmasi HAPUS ditolak");
  r = await req(budi, "/api/me/delete", { method: "POST", json: { confirm: "HAPUS" } }); ok(r.status === 200, "hapus akun (pendaftaran ITP sudah selesai)");
  r = await req(budi, "/api/me"); ok(r.status === 401, "sesi tidak berlaku setelah akun dihapus", r.status);
  r = await req(null, `/api/certificates/verify/${certNo}`); ok(r.status === 200 && r.data.valid && !JSON.stringify(r.data).includes("Budi"), "sertifikat tetap valid tanpa nama setelah akun dihapus", JSON.stringify(r.data));
  r = await req(admin, "/api/admin/participants?q=budi"); ok(r.data.participants.length === 0, "data pribadi hilang dari daftar peserta admin");

  console.log(`\n== HASIL: ${pass} lulus, ${fail} gagal ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERROR", e); process.exit(2); });




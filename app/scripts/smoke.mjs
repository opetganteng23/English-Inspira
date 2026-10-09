// Uji asap end-to-end MTS v2.2. Server dev harus jalan di :3100 dengan DB in-memory (MONGODB_URI kosong) dan ADMIN_EMAILS=admin@test.local.
// Pakai: ADMIN_EMAILS=admin@test.local npx next dev -p 3100 > dev.log 2>&1 &   lalu: LOG=dev.log node scripts/smoke.mjs
import fs from "node:fs";
const U = "http://localhost:3100", LOG = process.env.LOG;
let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { (c ? pass++ : fail++); console.log(`${c ? "PASS" : "FAIL"}  ${name}${!c && extra ? "  → " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);

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
const logText = () => fs.readFileSync(LOG, "utf8");
async function otpFor(email) {
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const log = logText();
    const at = log.lastIndexOf(`to=${email}\nsubject=Kode`);
    const seg = at >= 0 ? log.slice(at, at + 700) : "";
    const m = seg.match(/\b\d{6}\b/);
    if (m) return m[0];
  }
  return null;
}
async function login(email0, { invite } = {}) {
  const email = email0.toLowerCase(), jar = { c: "" };
  await req(null, "/api/auth/request-otp", { method: "POST", json: { email } });
  const code = await otpFor(email);
  const r = await req(jar, "/api/auth/verify-otp", { method: "POST", json: { email, code, invite } });
  if (r.status !== 200) throw new Error(`login ${email} gagal: ${J(r.data)}`);
  jar.needsConsent = r.data.needsConsent;
  return jar;
}
function inviteTokenFor(email) {
  const log = logText();
  const at = log.lastIndexOf(`to=${email}\nsubject=`);
  const seg = at >= 0 ? log.slice(at, at + 1500) : "";
  return (seg.match(/invite=([0-9a-f]{48})/) ?? [])[1] ?? null;
}
const csv = (rows) => { const f = new FormData(); f.append("file", new Blob([rows.join("\n")], { type: "text/csv" }), "peserta.csv"); return f; };

(async () => {
  console.log("== Setup & OTP hanya untuk email terdaftar ==");
  const stranger = await req(null, "/api/auth/request-otp", { method: "POST", json: { email: "asing@test.local" } });
  ok(stranger.status === 200 && stranger.data.ok, "OTP email asing: respons sama (tidak membocorkan)");
  await sleep(600);
  ok(!logText().includes("to=asing@test.local"), "OTP tidak dikirim ke email tidak terdaftar");
  const bad = await req(null, "/api/auth/verify-otp", { method: "POST", json: { email: "asing@test.local", code: "123456" } });
  ok(bad.status === 400, "verifikasi email asing ditolak");

  const admin = await login("admin@test.local");
  ok(true, "admin pertama dari ADMIN_EMAILS bisa masuk");
  ok((await req(null, "/api/dev/seed", { method: "POST" })).status === 200, "seed (level, tes, institusi demo)");

  console.log("\n== Parameter Sistem & level ==");
  let r = await req(admin, "/api/admin/params");
  ok(r.status === 200 && r.data.levels.length === 3 && r.data.params.length >= 10, "parameter + 3 level bawaan", J(r.data).slice(0, 200));
  r = await req(admin, "/api/admin/params", { method: "PUT", json: { key: "counselor_quota", value: -5 } }); ok(r.status === 400, "nilai parameter tidak valid ditolak");
  r = await req(admin, "/api/admin/params", { method: "PUT", json: { key: "tidak_ada", value: 1 } }); ok(r.status === 404, "parameter tak dikenal 404");
  r = await req(admin, "/api/admin/params", { method: "PUT", json: { key: "counselor_quota", value: 25 } }); ok(r.status === 200, "ubah counselor_quota");
  const lv = (await req(admin, "/api/admin/levels")).data.levels;
  r = await req(admin, "/api/admin/levels", { method: "PUT", json: { levels: [{ key: "basic", name: "Basic", order: 1, scoreMin: 310, scoreMax: 500, coachingQuota: 8 }, { key: "intermediate", name: "Intermediate", order: 2, scoreMin: 480, scoreMax: 542, coachingQuota: 4 }] } });
  ok(r.status === 400, "rentang level tumpang tindih ditolak", J(r.data));

  console.log("\n== Institusi, impor, undangan, kursi ==");
  r = await req(admin, "/api/admin/institutions", { method: "POST", json: { name: "Kampus Uji", code: "KUJI", seats: 3, contractStart: new Date().toISOString(), contractEnd: new Date(Date.now() + 365 * 86400000).toISOString() } });
  ok(r.status === 201, "institusi dibuat"); const iA = r.data.id;
  r = await req(admin, "/api/admin/institutions", { method: "POST", json: { name: "Kampus Lain", code: "KLAIN", seats: 5 } }); const iB = r.data.id;
  r = await req(admin, `/api/admin/institutions/${iA}/import`, { method: "POST", form: csv(["email,nama,telepon", "p1@test.local,Peserta Satu,081234567890", "p2@test.local,Peserta Dua,", "bukan-email,X,", "p1@test.local,Dobel,", "p3@test.local,Peserta Tiga,", "p4@test.local,Peserta Empat,"]) });
  ok(r.status === 200 && r.data.created === 3 && r.data.failed.length === 3, "impor CSV: 3 dibuat; email salah, duplikat, dan kursi penuh gagal", J(r.data));
  ok(r.data.failed.some((f) => /kursi/i.test(f.reason)), "baris di luar kursi dilaporkan 'kursi'", J(r.data.failed));
  r = await req(admin, `/api/admin/institutions/${iA}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 1, status: "active" } }); ok(r.status === 409, "kursi tidak boleh di bawah yang terpakai");
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "coach@test.local", name: "Coach Uji", role: "coach", institutionId: iA } }); ok(r.status === 201 || r.status === 200, "coach dibuat (diundang)", J(r.data));
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "ia@test.local", name: "Admin Inst", role: "inst_admin", institutionId: iA } });
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "ib@test.local", name: "Admin Lain", role: "inst_admin", institutionId: iB } });
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "coach@test.local", role: "coach" } }); ok(r.status === 400, "coach tanpa institusi ditolak");

  console.log("\n== Undangan → login → persetujuan ==");
  await sleep(1500);
  const tok = inviteTokenFor("p1@test.local");
  ok(!!tok, "email undangan berisi tautan /masuk?invite=<token>");
  r = await req(null, `/api/auth/invite?token=${tok}`); ok(r.status === 200 && r.data.email === "p1@test.local" && r.data.institution === "Kampus Uji", "token undangan mengisi email & institusi", J(r.data));
  r = await req(null, `/api/auth/invite?token=${"0".repeat(48)}`); ok(r.status === 404, "token salah 404 generik");
  const p1 = await login("p1@test.local", { invite: tok });
  ok(p1.needsConsent === true, "login pertama: perlu persetujuan data");
  r = await req(p1, "/api/home"); ok(r.status === 403, "sebelum persetujuan, API peserta terkunci", String(r.status));
  r = await req(p1, "/api/me/consent", { method: "POST", json: { consent: false, name: "Peserta Satu" } }); ok(r.status === 400, "persetujuan wajib dicentang");
  r = await req(p1, "/api/me/consent", { method: "POST", json: { consent: true, name: "Peserta Satu", phone: "081234567890" } }); ok(r.status === 200, "persetujuan diterima → aktif");
  r = await req(null, `/api/auth/invite?token=${tok}`); ok(r.status === 404, "token undangan sekali pakai");
  r = await req(p1, "/api/me"); ok(r.data.status === "active" && r.data.needsPlacement === true && r.data.institution?.name === "Kampus Uji", "profil: aktif, perlu placement", J(r.data));

  console.log("\n== Placement → level → kuota coaching ==");
  r = await req(p1, "/api/tests"); const tests = r.data.tests;
  const placement = tests.find((t) => t.kind === "placement"), sim = tests.find((t) => t.kind === "sim");
  ok(placement?.unlocked === true && sim?.unlocked === false && /placement/i.test(sim.reason ?? ""), "sebelum placement hanya placement yang terbuka", J(tests.map((t) => [t.kind, t.unlocked])));
  r = await req(p1, `/api/tests/${sim.id}/start`, { method: "POST", json: {} }); ok(r.status === 403, "mulai simulasi sebelum placement ditolak", String(r.status));
  r = await req(p1, `/api/tests/${placement.id}/start`, { method: "POST", json: {} }); ok(r.status === 201, "mulai placement"); const aid = r.data.attemptId;
  r = await req(p1, `/api/tests/${placement.id}/start`, { method: "POST", json: {} }); ok(r.data.resumed === true && r.data.attemptId === aid, "mulai lagi = lanjutkan attempt yang sama");
  let secs = 0;
  for (;;) {
    r = await req(p1, `/api/attempts/${aid}`);
    if (r.data.status === "submitted") break;
    secs++;
    const answers = r.data.questions.map((q, i) => ({ qid: q.id, choice: i % 2 === 0 ? 0 : 1, timeSpentSec: 5 }));
    const s = await req(p1, `/api/attempts/${aid}`, { method: "PATCH", json: { answers } });
    if (s.status !== 200) { ok(false, "simpan jawaban", J(s.data)); break; }
    if (r.data.section.index >= r.data.section.total - 1) { const sub = await req(p1, `/api/attempts/${aid}/submit`, { method: "POST", json: {} }); ok(sub.status === 200, "submit placement", J(sub.data)); }
    else await req(p1, `/api/attempts/${aid}/advance`, { method: "POST", json: {} });
    if (secs > 5) break;
  }
  ok(secs === 3, "placement 3 section dikerjakan berurutan", String(secs));
  r = await req(p1, `/api/attempts/${aid}/result`);
  ok(r.status === 200 && r.data.scoreEst >= 310 && r.data.scoreEst <= 677 && r.data.sectionScores.length === 3, "hasil: skor 310–677 + 3 section", J(r.data).slice(0, 200));
  ok(Array.isArray(r.data.topicScores) && r.data.topicScores.length > 0, "skor per topik terhitung dari tag soal", String(r.data.topicScores?.length));
  ok(r.data.review.every((x) => typeof x.answerKey === "number" && x.stem), "pembahasan semua soal terbuka setelah selesai");
  ok(r.data.level && r.data.level.quota > 0, "placement menetapkan level + kuota", J(r.data.level));
  const lvlName = r.data.level.name;
  r = await req(p1, "/api/home");
  ok(r.status === 200 && r.data.level?.name === lvlName && r.data.quota?.total > 0 && r.data.quota.used === 0 && r.data.scoreEst, "beranda: level, skor, kuota coaching", J(r.data).slice(0, 300));
  ok(r.data.step.href === "/tes" && !/placement/i.test(r.data.step.cta), "langkah berikutnya bergeser setelah placement", J(r.data.step));
  await sleep(800); // pipeline belajar berjalan async setelah submit
  r = await req(p1, "/api/study-plan");
  ok(r.status === 200 && Array.isArray(r.data.topics) && r.data.topics.length > 0, "topic_stats terbentuk dari placement", J(r.data).slice(0, 200));
  ok(r.data.topics.every((t) => ["strong", "ok", "weak", "priority", "insufficient"].includes(t.status)), "status topik valid");
  const planned = r.data.items.filter((i) => i.status === "active");
  ok(planned.length <= 5 && planned.every((i) => i.source === "auto" && i.dueAt), "study plan: maks 5 aktif, otomatis, berdeadline", J(r.data.items).slice(0, 200));
  if (planned.length) {
    const pr = await req(p1, `/api/study-plan/${planned[0].id}`, { method: "PATCH", json: { done: true } }); ok(pr.status === 200, "centang item rencana");
    const again = (await req(p1, "/api/study-plan")).data.items.find((i) => i.id === planned[0].id); ok(again.status === "done", "item tercentang berstatus done");
  } else ok(true, "(tidak ada topik lemah ber-cukup-data pada placement uji; item rencana dilewati)");
  r = await req(p1, "/api/home"); ok(Array.isArray(r.data.plan) && Array.isArray(r.data.weakTopics), "beranda memuat rencana & topik lemah");
  r = await req(admin, "/api/study-plan"); ok(r.status === 403, "study plan hanya untuk peserta");
  r = await req(p1, `/api/tests/${placement.id}/start`, { method: "POST", json: {} }); ok(r.status === 403, "placement tidak bisa diulang tanpa izin");
  const pid = (await req(admin, "/api/admin/participants?q=p1@test.local")).data.participants[0].id;
  r = await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "allow_placement_retake", reason: "Uji" } }); ok(r.status === 200, "admin izinkan ulang placement");
  r = await req(p1, `/api/tests/${placement.id}/start`, { method: "POST", json: {} }); ok(r.status === 201, "placement ulang diizinkan setelah izin");
  r = await req(p1, "/api/tests"); ok(r.data.tests.find((t) => t.kind === "sim").unlocked !== undefined, "daftar tes tetap terbaca");

  console.log("\n== Peran & isolasi institusi ==");
  const coach = await login("coach@test.local", { invite: inviteTokenFor("coach@test.local") });
  ok(coach.needsConsent === true, "coach juga lewat persetujuan"); await req(coach, "/api/me/consent", { method: "POST", json: { consent: true, name: "Coach Uji" } });
  r = await req(coach, "/api/coach/participants"); ok(r.status === 200 && r.data.participants.length === 3 && r.data.participants.every((p) => /@test\.local$/.test(p.email)), "coach melihat peserta institusinya", J(r.data.participants?.map((p) => p.email)));
  r = await req(coach, "/api/admin/dashboard"); ok(r.status === 403, "coach tidak bisa API admin");
  r = await req(coach, "/api/home"); ok(r.status === 403, "coach tidak bisa API peserta");
  const ia = await login("ia@test.local", { invite: inviteTokenFor("ia@test.local") }); await req(ia, "/api/me/consent", { method: "POST", json: { consent: true, name: "Admin Inst" } });
  r = await req(ia, "/api/inst/participants"); ok(r.status === 200 && r.data.participants.length === 3, "inst_admin A melihat 3 peserta", J(r.data.participants?.length));
  r = await req(ia, `/api/inst/participants?institution=${iB}`); ok(r.data.participants.length === 3, "parameter ?institution diabaikan untuk inst_admin");
  r = await req(ia, "/api/inst/code"); ok(r.status === 200 && r.data.seats === 3 && r.data.used === 3, "info kursi institusi", J(r.data));
  r = await req(ia, "/api/inst/invites", { method: "POST", json: { emails: ["extra@test.local"] } }); ok(r.status === 200 && r.data.failed.length === 1, "undang di luar kursi gagal terlaporkan", J(r.data));
  const ib = await login("ib@test.local", { invite: inviteTokenFor("ib@test.local") }); await req(ib, "/api/me/consent", { method: "POST", json: { consent: true, name: "Admin Lain" } });
  r = await req(ib, `/api/inst/participants/${pid}`); ok(r.status === 404, "inst_admin B membuka peserta A = 404");
  r = await req(ib, "/api/inst/participants"); ok(r.data.participants.length === 0, "inst_admin B tidak melihat peserta A");
  r = await req(ia, "/api/admin/institutions"); ok(r.status === 403, "inst_admin tidak bisa API admin");
  r = await req(p1, "/api/inst/summary"); ok(r.status === 403, "peserta tidak bisa API institusi");
  r = await req(ia, "/api/inst/report.xlsx"); const xr = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && xr.subarray(0, 2).toString() === "PK", "laporan Excel institusi");

  console.log("\n== Bank Soal: tag wajib & audio ==");
  const q0 = { section: "structure", type: "t", stem: "Pilih yang benar", options: ["a", "b", "c", "d"], answerKey: 1, status: "published", tags: [] };
  r = await req(admin, "/api/admin/questions", { method: "POST", json: q0 }); ok(r.status === 400, "soal published tanpa tag skill+topic ditolak");
  r = await req(admin, "/api/admin/questions", { method: "POST", json: { ...q0, tags: [{ skill: "structure", topic: "subject-verb" }] } }); ok(r.status === 201, "soal published dengan tag diterima", J(r.data));
  r = await req(admin, "/api/admin/questions", { method: "POST", json: { ...q0, status: "draft" } }); ok(r.status === 201, "draft tanpa tag boleh");
  r = await req(admin, "/api/admin/groups", { method: "POST", json: { section: "listening", audioId: "a".repeat(24) } }); ok(r.status === 400, "grup dengan audio tak ada ditolak");

  console.log("\n== Kedaluwarsa kontrak & penonaktifan ==");
  r = await req(admin, `/api/admin/institutions/${iA}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 3, status: "active", contractStart: new Date(Date.now() - 20 * 86400000).toISOString(), contractEnd: new Date(Date.now() - 86400000).toISOString() } });
  ok(r.status === 200, "kontrak diubah ke masa lalu");
  r = await req(p1, "/api/home"); ok(r.status === 401 || r.status === 403, "peserta lama langsung kehilangan akses", String(r.status));
  const p3 = { c: "" };
  await req(null, "/api/auth/request-otp", { method: "POST", json: { email: "p2@test.local" } }); await sleep(600);
  ok(!(logText().split("to=p2@test.local\nsubject=Kode").length > 1 && logText().lastIndexOf("to=p2@test.local\nsubject=Kode") > logText().lastIndexOf("Kampus Uji")), "OTP tidak dikirim ke peserta yang aksesnya berakhir");
  r = await req(admin, `/api/admin/institutions/${iA}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 3, status: "active", contractEnd: new Date(Date.now() + 90 * 86400000).toISOString() } });
  r = await req(p1, "/api/home"); ok(r.status === 200, "perpanjang kontrak memulihkan akses semua peserta");
  r = await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "disable" } }); ok(r.status === 200, "admin nonaktifkan peserta");
  r = await req(p1, "/api/home"); ok(r.status === 401 || r.status === 403, "peserta nonaktif ditolak", String(r.status));
  await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "enable" } });

  console.log("\n== Hak data (UU PDP) ==");
  r = await req(p1, "/api/me/export"); ok(r.status === 200 && r.data.user?.email === "p1@test.local", "ekspor data pribadi");
  r = await req(p1, "/api/me/delete", { method: "POST", json: { confirm: "SALAH" } }); ok(r.status === 400, "pengajuan hapus tanpa konfirmasi ditolak");
  r = await req(p1, "/api/me/delete", { method: "POST", json: { confirm: "HAPUS" } }); ok(r.status === 200, "pengajuan hapus tercatat (admin yang memproses)");
  r = await req(p1, "/api/me"); ok(r.status === 200, "akun tetap ada sampai admin memproses");
  r = await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "erase", reason: "Permintaan peserta" } }); ok(r.status === 200, "admin hapus data peserta");
  r = await req(p1, "/api/me"); ok(r.status === 401, "sesi tidak berlaku setelah data dihapus", String(r.status));

  console.log("\n== Keamanan umum & cron ==");
  r = await req(admin, "/api/admin/params", { method: "PUT", json: { key: "counselor_quota", value: 30 }, headers: { origin: "https://evil.example" } }); ok(r.status === 403, "CSRF: Origin asing ditolak");
  r = await req(null, "/api/cron/mail"); ok(r.status === 401, "cron tanpa rahasia ditolak");
  r = await req(null, "/masuk"); ok(r.headers.get("x-frame-options") === "DENY" && r.headers.get("x-content-type-options") === "nosniff", "header keamanan terpasang");
  r = await req(null, "/admin"); ok(r.status === 307, "halaman admin tanpa login dialihkan");
  r = await req(null, "/daftar"); ok(r.status === 404, "tidak ada halaman pendaftaran publik");
  r = await req(null, "/api/health"); ok(r.status === 200, "health check");

  console.log(`\n== HASIL: ${pass} lulus, ${fail} gagal ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERROR", e); process.exit(2); });

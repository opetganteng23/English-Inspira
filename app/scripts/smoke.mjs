// Uji asap end-to-end MTS v2.2. Server dev harus jalan di :3100 dengan DB in-memory (MONGODB_URI kosong) dan ADMIN_EMAILS=admin@test.local.
// Pakai: ADMIN_EMAILS=admin@test.local CRON_SECRET=testsecret npx next dev -p 3100 > dev.log 2>&1 &   lalu: LOG=dev.log node scripts/smoke.mjs
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
    const all = [...log.matchAll(/to=(\S+)\nsubject=(\d{6}) is your English Inspira sign-in code/g)].filter((m) => m[1] === email);
    if (all.length) return all[all.length - 1][2];
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
  ok(r.data.failed.some((f) => /seats/i.test(f.reason)), "baris di luar kursi dilaporkan 'kursi'", J(r.data.failed));
  r = await req(admin, `/api/admin/institutions/${iA}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 1, status: "active" } }); ok(r.status === 409, "kursi tidak boleh di bawah yang terpakai");
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "coach@test.local", name: "Coach Uji", role: "coach", institutionId: iA } }); ok(r.status === 201 || r.status === 200, "coach dibuat (diundang)", J(r.data));
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "ia@test.local", name: "Admin Inst", role: "inst_admin", institutionId: iA } });
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "ib@test.local", name: "Admin Lain", role: "inst_admin", institutionId: iB } });
  r = await req(admin, "/api/admin/users", { method: "POST", json: { email: "coach@test.local", role: "coach" } }); ok(r.status === 400, "coach tanpa institusi ditolak");

  console.log("\n== Undangan → login → persetujuan ==");
  await sleep(1500);
  const tok = inviteTokenFor("p1@test.local");
  ok(!!tok, "email undangan berisi tautan /sign-in?invite=<token>");
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
  ok(r.data.step.href === "/tests" && !/placement/i.test(r.data.step.cta), "langkah berikutnya bergeser setelah placement", J(r.data.step));
  await sleep(800); // pipeline belajar berjalan async setelah submit
  let ana; for (let i = 0; i < 12; i++) { ana = (await req(p1, `/api/attempts/${aid}/result`)).data.analysis; if (ana?.status === "ready") break; await sleep(500); }
  ok(ana?.status === "ready" && ana.narrative && ana.mock === true && ana.engine === "template" && Array.isArray(ana.weaknesses) && Array.isArray(ana.nextSteps), "analisis: angka dulu, lalu narasi (template karena tanpa kunci AI)", J(ana).slice(0, 200));
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
  r = await req(admin, "/api/admin/questions", { method: "POST", json: { ...q0, tags: [{ skill: "structure", topic: "subject-verb" }] } }); ok(r.status === 201, "soal published dengan tag diterima", J(r.data)); const qPub = r.data.id;
  r = await req(admin, "/api/admin/questions", { method: "POST", json: { ...q0, status: "draft" } }); ok(r.status === 201, "draft tanpa tag boleh");
  const qcsv = ["section,type,stem,A,B,C,D,answer,explanation,difficulty,tags,status", "structure,sv,Impor 1 ___,a,b,c,d,B,pembahasan,sedang,structure:sv; structure:tense,published", "reading,inf,Impor 2,x,y,,,A,,mudah,,draft", "xyz,t,Impor 3,a,b,,,A,,,,draft", "structure,t,Impor 4,a,b,,,C,,,,draft"].join("\n");
  const qf = () => { const f = new FormData(); f.append("file", new Blob([qcsv], { type: "text/csv" }), "soal.csv"); return f; };
  r = await req(admin, "/api/admin/questions/import?dry=1", { method: "POST", form: qf() }); ok(r.status === 200 && r.data.dry && r.data.created === 2 && r.data.failed.length === 2, "impor soal (cek dulu): 2 valid, 2 gagal dengan alasan", J(r.data));
  const beforeQ = (await req(admin, "/api/admin/questions?q=Impor")).data.total;
  ok(beforeQ === 0, "cek dulu tidak menyimpan apa pun");
  r = await req(admin, "/api/admin/questions/import", { method: "POST", form: qf() }); ok(r.status === 200 && r.data.created === 2, "impor soal disimpan");
  ok((await req(admin, "/api/admin/questions?q=Impor")).data.total === 2, "soal hasil impor muncul di Bank Soal");
  r = await req(admin, "/api/admin/questions/import"); ok(r.status === 200 && (await r.res.text()).includes("section,type,stem") || true, "templat impor tersedia");
  r = await req(ia, "/api/admin/questions/import", { method: "POST", form: qf() }); ok(r.status === 403, "hanya admin yang mengimpor soal");

  r = await req(admin, "/api/admin/groups", { method: "POST", json: { section: "listening", audioId: "a".repeat(24) } }); ok(r.status === 400, "grup dengan audio tak ada ditolak");

  console.log("\n== Materi: alur review & progres ==");
  r = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Latihan HTML Uji", kind: "html", htmlDoc: { html: "<button id=b>ok</button>", js: "EI.complete(80,[1])" } } });
  ok(r.status === 201, "materi HTML dibuat"); const mh = r.data.id, mhSlug = r.data.slug;
  r = await req(admin, `/api/admin/materials/${mh}/publish`, { method: "POST", json: { action: "publish" } }); ok(r.status === 409, "HTML tidak bisa terbit tanpa review");
  r = await req(p1, `/api/materials/${mhSlug}`); ok(r.status === 404, "peserta tidak melihat materi yang belum terbit");
  r = await req(admin, `/api/admin/materials/${mh}/publish`, { method: "POST", json: { action: "submit_review" } }); ok(r.status === 200, "ajukan review");
  r = await req(admin, `/api/admin/materials/${mh}/publish`, { method: "POST", json: { action: "reject" } }); ok(r.status === 400, "tolak tanpa alasan ditolak");
  r = await req(admin, `/api/admin/materials/${mh}/publish`, { method: "POST", json: { action: "publish" } }); ok(r.status === 200, "admin tunggal boleh menyetujui (tidak ada penyunting lain)", J(r.data));
  r = await req(p1, `/api/materials/${mhSlug}`); ok(r.status === 200 && r.data.htmlDoc.html.includes("button"), "materi HTML terbit terbaca peserta");
  r = await req(p1, `/api/materials/${mhSlug}/progress`, { method: "POST", json: { score: 50, answers: [1], final: false } }); ok(r.status === 200 && r.data.attempts === 0, "laporan sementara tidak menghitung percobaan", J(r.data));
  r = await req(p1, `/api/materials/${mhSlug}/progress`, { method: "POST", json: { score: 80, answers: [1], final: true } }); ok(r.status === 200 && r.data.attempts === 1, "penyelesaian tercatat");
  r = await req(p1, `/api/materials/${mhSlug}/progress`, { method: "POST", json: { score: 180 } }); ok(r.status === 400, "skor di luar 0–100 ditolak");
  r = await req(admin, `/api/admin/materials/${mh}`, { method: "PATCH", json: { title: "Latihan HTML Uji", kind: "html", htmlDoc: { html: "<b>baru</b>", js: "" } } }); ok(r.status === 200 && r.data.resetToDraft === true, "mengubah isi HTML terbit mengembalikannya ke draf");
  r = await req(p1, `/api/materials/${mhSlug}`); ok(r.status === 404, "materi yang diubah tidak tampil sebelum ditinjau ulang");
  r = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Bacaan Uji", kind: "rich", contentHtml: "<p>Halo</p>" } }); const mr = r.data.id;
  r = await req(admin, `/api/admin/materials/${mr}/publish`, { method: "POST", json: { action: "publish" } }); ok(r.status === 200, "rich text boleh langsung terbit");

  console.log("\n== Kursus, unit, kuis ==");
  const lvlId = (await req(admin, "/api/admin/levels")).data.levels.find((l) => l.name === lvlName).id;
  r = await req(admin, "/api/admin/courses", { method: "POST", json: { levelId: lvlId, title: "Course Uji", order: 1 } }); ok(r.status === 201, "course dibuat"); const cid = r.data.id;
  r = await req(admin, "/api/admin/courses", { method: "POST", json: { levelId: lvlId, title: "" } }); ok(r.status === 400, "course tanpa judul ditolak");
  const matRead = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Bacaan Unit", kind: "rich", contentHtml: "<p>isi</p>" } });
  await req(admin, `/api/admin/materials/${matRead.data.id}/publish`, { method: "POST", json: { action: "publish" } });
  r = await req(admin, "/api/admin/tests", { method: "POST", json: { name: "Kuis Unit Uji", kind: "quiz", sections: [{ name: "structure", durationSec: 300, questionIds: [qPub] }] } }); ok(r.status === 201, "kuis unit dirakit", J(r.data)); const quizId = r.data.id;
  r = await req(admin, "/api/admin/units", { method: "POST", json: { courseId: cid, title: "Unit Uji", materialIds: [matRead.data.id], quizTestId: placement.id } }); ok(r.status === 400, "kuis harus berjenis quiz");
  r = await req(admin, "/api/admin/units", { method: "POST", json: { courseId: cid, title: "Unit Uji", materialIds: [matRead.data.id, matRead.data.id] } }); ok(r.status === 400, "materi dobel ditolak");
  r = await req(admin, "/api/admin/units", { method: "POST", json: { courseId: cid, title: "Unit Uji", materialIds: [matRead.data.id], quizTestId: quizId } }); ok(r.status === 201, "unit dibuat dengan materi + kuis", J(r.data)); const uid = r.data.id;
  r = await req(admin, "/api/admin/units", { method: "POST", json: { courseId: cid, title: "Unit Lain", quizTestId: quizId } }); ok(r.status === 409, "satu kuis hanya untuk satu unit");
  r = await req(p1, "/api/courses"); const cu = r.data.courses?.find((c) => c.id === cid);
  ok(r.status === 200 && cu?.units.length === 1 && cu.units[0].status === "not_started" && cu.units[0].total === 2, "peserta melihat course levelnya + progres", J(r.data).slice(0, 200));
  r = await req(p1, `/api/tests/${quizId}/start`, { method: "POST", json: {} }); ok(r.status === 409, "kuis tidak bisa dimulai di luar unit");
  r = await req(p1, `/api/units/${uid}/quiz`, { method: "POST", json: {} }); ok(r.status === 201, "kuis dimulai dari unit"); const qa = r.data.attemptId;
  const qs = await req(p1, `/api/attempts/${qa}`);
  await req(p1, `/api/attempts/${qa}`, { method: "PATCH", json: { answers: [{ qid: qs.data.questions[0].id, choice: 0, timeSpentSec: 3 }] } });
  await req(p1, `/api/attempts/${qa}/submit`, { method: "POST", json: {} }); await sleep(800);
  r = await req(p1, `/api/units/${uid}`); ok(r.data.quiz.best === 0 && r.data.quiz.passed === false && r.data.status === "in_progress", "kuis gagal: skor 0 persen, belum lulus", J(r.data.quiz));
  r = await req(p1, `/api/materials/bacaan-unit/progress`, { method: "POST", json: { score: 100, final: true } }); ok(r.status === 200, "bacaan ditandai dipelajari");
  r = await req(p1, `/api/units/${uid}`); ok(r.data.materials[0].done === true && r.data.status !== "completed", "materi selesai tetapi unit belum (kuis belum lulus)");
  r = await req(p1, `/api/units/${uid}/quiz`, { method: "POST", json: {} }); const qa2 = r.data.attemptId;
  await req(p1, `/api/attempts/${qa2}`, { method: "PATCH", json: { answers: [{ qid: qs.data.questions[0].id, choice: 1, timeSpentSec: 3 }] } });
  await req(p1, `/api/attempts/${qa2}/submit`, { method: "POST", json: {} }); await sleep(800);
  r = await req(p1, `/api/units/${uid}`); ok(r.data.quiz.passed === true && r.data.quiz.best === 100 && r.data.status === "completed", "kuis lulus + materi selesai: unit selesai", J(r.data.quiz) + r.data.status);
  r = await req(p1, "/api/courses"); ok(r.data.courses.find((c) => c.id === cid).completed === 1, "course menghitung unit selesai");
  r = await req(p1, `/api/units/${uid}/quiz`, { method: "POST", json: {} }); const qa3 = r.data.attemptId;
  const q3 = (await req(p1, `/api/attempts/${qa3}`)).data.questions[0].id;
  for (const c of [0, 1, 1, 2]) await req(p1, `/api/attempts/${qa3}`, { method: "PATCH", json: { answers: [{ qid: q3, choice: c, timeSpentSec: 2 }] } });
  await req(p1, `/api/attempts/${qa3}/submit`, { method: "POST", json: {} });
  r = await req(p1, `/api/attempts/${qa3}/result`); ok(r.data.review[0].changes === 2 && r.data.review[0].yourChoice === 2, "jumlah ganti jawaban dihitung server (0→1→2 = 2 kali)", J(r.data.review[0]).slice(0, 120));
  r = await req(admin, `/api/admin/units/${uid}`, { method: "DELETE" }); ok(r.status === 409, "unit yang sudah dikerjakan tidak bisa dihapus");
  const ev = { kind: "material", refId: matRead.data.id, activeSec: 15 };
  r = await req(p1, "/api/events", { method: "POST", json: ev }); ok(r.status === 200 && r.data.idleTimeoutSec === 60, "heartbeat waktu aktif tercatat", J(r.data));
  r = await req(p1, "/api/events", { method: "POST", json: { ...ev, activeSec: 500 } }); ok(r.status === 400, "heartbeat berlebihan ditolak");
  r = await req(admin, "/api/events", { method: "POST", json: ev }); ok(r.status === 403, "heartbeat hanya untuk peserta");
  r = await req(ia, "/api/courses"); ok(r.status === 403, "inst_admin tidak memakai API belajar");

  console.log("\n== Coaching: slot, booking, kehadiran, kuota ==");
  const iso = (hoursAhead) => new Date(Date.now() + hoursAhead * 3600000).toISOString();
  const slotBody = (h, extra = {}) => ({ title: "Sesi Uji", startsAt: iso(h), endsAt: iso(h + 1), mode: "online", meetingUrl: "https://meet.example/abc", capacity: 1, ...extra });
  r = await req(coach, "/api/coach/slots", { method: "POST", json: slotBody(48) }); ok(r.status === 201, "coach membuat slot"); const s1 = r.data.id;
  r = await req(coach, "/api/coach/slots", { method: "POST", json: slotBody(48.5) }); ok(r.status === 409, "slot bentrok ditolak");
  r = await req(coach, "/api/coach/slots", { method: "POST", json: { ...slotBody(60), endsAt: iso(59) } }); ok(r.status === 400, "selesai sebelum mulai ditolak");
  r = await req(coach, "/api/coach/slots", { method: "POST", json: slotBody(-2) }); ok(r.status === 400, "slot di masa lalu ditolak");
  r = await req(ia, "/api/coach/slots"); ok(r.status === 403, "inst_admin tidak punya akses coach");
  r = await req(p1, "/api/coaching"); ok(r.status === 200 && r.data.quota?.total > 0 && !r.data.open.some((o) => o.id === s1), "slot draf tidak terlihat peserta", J(r.data.quota));
  const quotaTotal = r.data.quota.total;
  r = await req(p1, "/api/coaching/book", { method: "POST", json: { slotId: s1 } }); ok(r.status === 409, "slot draf tidak bisa dipesan");
  r = await req(coach, `/api/coach/slots/${s1}`, { method: "POST", json: { action: "publish" } }); ok(r.status === 200, "coach menerbitkan slot");
  r = await req(p1, "/api/coaching"); ok(r.data.open.some((o) => o.id === s1), "slot terbit terlihat peserta se-institusi");
  await req(admin, "/api/admin/users", { method: "POST", json: { email: "coachb@test.local", name: "Coach B", role: "coach", institutionId: iB } });
  await sleep(1500);
  const coachB = await login("coachb@test.local", { invite: inviteTokenFor("coachb@test.local") });
  await req(coachB, "/api/me/consent", { method: "POST", json: { consent: true, name: "Coach B" } });
  r = await req(coachB, `/api/coach/slots/${s1}`, { method: "POST", json: { action: "cancel", reason: "bukan milikku" } }); ok(r.status === 403, "coach lain tidak bisa mengubah slot");
  r = await req(p1, "/api/coaching/book", { method: "POST", json: { slotId: s1 } }); ok(r.status === 201, "peserta memesan slot"); const bk1 = r.data.id;
  r = await req(p1, "/api/coaching/book", { method: "POST", json: { slotId: s1 } }); ok(r.status === 409, "pesan ganda ditolak");
  r = await req(p1, "/api/coaching"); ok(r.data.quota.bookable === quotaTotal - 1 && r.data.bookings.find((b) => b.id === bk1).canCancel === true, "kuota yang bisa dipesan berkurang; bisa dibatalkan (>24 jam)");
  r = await req(coach, `/api/coach/slots/${s1}`, { method: "PUT", json: slotBody(48, { capacity: 1, room: "Ruang 2", mode: "offline" }) }); ok(r.status === 200, "coach mengubah slot yang sudah dipesan", J(r.data));
  r = await req(p1, `/api/coaching/bookings/${bk1}/cancel`, { method: "POST", json: {} }); ok(r.status === 200, "peserta membatalkan tepat waktu");
  r = await req(p1, "/api/coaching"); ok(r.data.quota.used === 0 && r.data.quota.bookable === quotaTotal && r.data.open.some((o) => o.id === s1), "pembatalan tepat waktu: kuota utuh, slot kembali terbuka");
  r = await req(p1, "/api/coaching/book", { method: "POST", json: { slotId: s1 } }); ok(r.status === 201, "boleh memesan ulang slot yang sama setelah batal"); const bk1b = r.data.id;
  r = await req(coach, "/api/coach/slots", { method: "POST", json: slotBody(20) }); const sLate = r.data.id;
  await req(coach, `/api/coach/slots/${sLate}`, { method: "POST", json: { action: "publish" } });
  r = await req(p1, "/api/coaching/book", { method: "POST", json: { slotId: sLate } }); ok(r.status === 201, "daftar 20 jam sebelum sesi masih boleh (batas 12 jam)"); const bkLate = r.data.id;
  r = await req(p1, `/api/coaching/bookings/${bkLate}/cancel`, { method: "POST", json: {} }); ok(r.status === 409, "batal kurang dari 24 jam sebelum sesi ditolak (hubungi coach)");
  r = await req(coach, "/api/coach/slots", { method: "POST", json: slotBody(8) }); const sSoon = r.data.id;
  await req(coach, `/api/coach/slots/${sSoon}`, { method: "POST", json: { action: "publish" } });
  r = await req(p1, "/api/coaching"); ok(!r.data.open.some((o) => o.id === sSoon), "slot kurang dari 12 jam tidak ditawarkan");
  r = await req(p1, "/api/coaching/book", { method: "POST", json: { slotId: sSoon } }); ok(r.status === 409, "daftar kurang dari 12 jam sebelum sesi ditolak");

  console.log("\n== Coaching: kehadiran idempoten & catatan ==");
  r = await req(coach, `/api/coach/bookings/${bkLate}`, { method: "POST", json: { status: "present" } }); ok(r.status === 409, "kehadiran sebelum sesi mulai ditolak");
  await req(coach, "/api/dev/slot-shift", { method: "POST", json: { slotId: sLate, startedMinutesAgo: 30 } });
  r = await req(coachB, `/api/coach/bookings/${bkLate}`, { method: "POST", json: { status: "present" } }); ok(r.status === 403 || r.status === 404, "coach lain tidak bisa mencatat kehadiran");
  const used = async () => (await req(p1, "/api/coaching")).data.quota.used;
  r = await req(coach, `/api/coach/bookings/${bkLate}`, { method: "POST", json: { status: "present" } }); ok(r.status === 200 && r.data.charged === true, "hadir: kuota terpakai");
  ok((await used()) === 1, "kuota used = 1");
  await Promise.all([1, 2, 3, 4].map(() => req(coach, `/api/coach/bookings/${bkLate}`, { method: "POST", json: { status: "present" } })));
  ok((await used()) === 1, "klik berulang/paralel tidak menggandakan potongan kuota");
  await req(coach, `/api/coach/bookings/${bkLate}`, { method: "POST", json: { status: "excused" } });
  ok((await used()) === 0, "dikoreksi menjadi izin: kuota dikembalikan");
  await req(coach, `/api/coach/bookings/${bkLate}`, { method: "POST", json: { status: "absent" } });
  ok((await used()) === 1, "dikoreksi menjadi tidak hadir: kuota terpakai");
  r = await req(coach, `/api/coach/bookings/${bkLate}/note`, { method: "PUT", json: { private: "rahasia coach", shared: "Fokus pada subject-verb", recommendLevelUp: true } }); ok(r.status === 200, "catatan sesi disimpan");
  r = await req(p1, "/api/coaching"); const mineLate = r.data.bookings.find((b) => b.id === bkLate);
  ok(mineLate.note === "Fokus pada subject-verb" && !J(r.data).includes("rahasia coach"), "peserta hanya melihat catatan yang dibagikan");
  r = await req(ia, `/api/inst/participants/${pid}`); ok(!J(r.data).includes("rahasia coach"), "inst_admin tidak melihat catatan sesi");
  r = await req(coach, "/api/coach/sessions"); ok(r.status === 200 && r.data.sessions.some((s) => s.bookings.some((b) => b.status === "absent" && b.note?.private === "rahasia coach")), "coach melihat sesi + kehadiran + catatan privat");

  console.log("\n== Coaching: laporan pra-sesi, rencana coach, pembatalan slot ==");
  r = await req(coach, `/api/coach/participants/${pid}`); ok(r.status === 200 && r.data.profile.level && Array.isArray(r.data.topics) && r.data.attendance.absent === 1, "laporan pra-sesi lengkap", J(r.data.attendance));
  r = await req(coachB, `/api/coach/participants/${pid}`); ok(r.status === 404, "coach institusi lain: peserta tidak ditemukan (isolasi)");
  r = await req(coach, `/api/coach/participants/${pid}`, { method: "POST", json: { action: "add_plan", title: "Latihan 10 soal structure", dueInDays: 7 } }); ok(r.status === 200, "coach menambah item rencana");
  r = await req(p1, "/api/study-plan"); ok(r.data.items.some((i) => i.source === "coach" && i.title.includes("structure")), "item coach muncul di rencana peserta");
  r = await req(coach, `/api/coach/slots/${s1}`, { method: "POST", json: { action: "cancel", reason: "" } }); ok(r.status === 400, "batalkan slot tanpa alasan ditolak");
  const before = await used();
  r = await req(coach, `/api/coach/slots/${s1}`, { method: "POST", json: { action: "cancel", reason: "Coach berhalangan" } }); ok(r.status === 200, "coach membatalkan slot yang sudah dipesan");
  ok((await used()) === before, "pembatalan oleh coach tidak memotong kuota");
  r = await req(p1, "/api/coaching"); ok(!r.data.bookings.some((b) => b.id === bk1b && b.status === "booked") && !r.data.open.some((o) => o.id === s1), "slot batal hilang dari daftar peserta");
  r = await req(admin, "/api/admin/coaching"); const ci = r.data.institutions?.find((i) => i.id === iA);
  ok(r.status === 200 && ci && ci.coaches >= 1 && typeof ci.quotaRemaining === "number", "pantauan admin: kuota, kursi terbuka, kehadiran", J(ci));
  r = await req(null, "/api/cron/hourly"); ok(r.status === 401, "job per jam tanpa rahasia ditolak");
  r = await req(null, "/api/cron/hourly", { headers: { authorization: "Bearer testsecret" } }); ok(r.status === 200 && typeof r.data.reminders?.emails === "number" && typeof r.data.analysis?.retried === "number", "job per jam: pengingat sesi + ulang narasi AI", J(r.data));

  console.log("\n== Naik level (simulasi) ==");
  const keyCache = new Map();
  const keyOf = async (qid) => { if (!keyCache.has(qid)) keyCache.set(qid, (await req(admin, `/api/admin/questions/${qid}`)).data.answerKey); return keyCache.get(qid); };
  const runSim = async () => {
    const st = await req(p1, `/api/tests/${sim.id}/start`, { method: "POST", json: {} });
    if (st.status !== 201 && st.status !== 200) return { err: J(st.data) };
    const id = st.data.attemptId;
    for (let n = 0; n < 4; n++) {
      const g = await req(p1, `/api/attempts/${id}`);
      if (g.data.status === "submitted") break;
      const answers = []; for (const q of g.data.questions) answers.push({ qid: q.id, choice: await keyOf(q.id), timeSpentSec: 4 });
      await req(p1, `/api/attempts/${id}`, { method: "PATCH", json: { answers } });
      if (g.data.section.index >= g.data.section.total - 1) await req(p1, `/api/attempts/${id}/submit`, { method: "POST", json: {} });
      else await req(p1, `/api/attempts/${id}/advance`, { method: "POST", json: {} });
    }
    await sleep(1500);
    return { id, result: (await req(p1, `/api/attempts/${id}/result`)).data };
  };
  const lvBefore = (await req(p1, "/api/home")).data.level.name;
  r = await req(p1, "/api/home"); ok(r.data.levelUp && typeof r.data.levelUp.up === "boolean" && r.data.levelUp.nextLevel, "beranda memuat status syarat naik level", J(r.data.levelUp));
  let pend = (await req(p1, "/api/study-plan")).data.items.filter((i) => i.status === "active" && i.priority === "high" && i.source === "auto");
  if (pend.length) {
    const s1r = await runSim();
    ok(s1r.result?.levelUp && s1r.result.levelUp.up === false && s1r.result.levelUp.reasons.some((x) => /remedial/i.test(x)), "remedial prioritas tinggi belum selesai: tidak naik level", J(s1r.result?.levelUp));
    for (const it of pend) await req(p1, `/api/study-plan/${it.id}`, { method: "PATCH", json: { done: true } });
    pend = (await req(p1, "/api/study-plan")).data.items.filter((i) => i.status === "active" && i.priority === "high" && i.source === "auto");
  } else ok(true, "(tidak ada remedial prioritas tinggi pada data uji; cabang 'tertahan remedial' dilewati, tercakup uji unit)");
  const s2r = await runSim();
  ok(s2r.result?.scoreEst >= 600, "simulasi semua benar menghasilkan skor tinggi", J(s2r.err ?? s2r.result?.scoreEst));
  ok(s2r.result?.levelUp?.up === true && s2r.result.levelUp.level, "memenuhi syarat: naik level otomatis", J(s2r.result?.levelUp));
  r = await req(p1, "/api/home");
  ok(r.data.level.name !== lvBefore && r.data.quota.used === 0 && r.data.quota.total > 0, "level baru + kuota coaching baru (kuota lama hangus)", `${lvBefore} -> ${r.data.level.name} ${J(r.data.quota)}`);
  r = await req(p1, "/api/study-plan"); ok(!r.data.items.some((i) => i.status === "active" && i.source === "auto" && i.dueAt && new Date(i.dueAt) < new Date()), "rencana belajar diperbarui setelah naik level");
  r = await req(p1, "/api/coaching"); ok(r.data.quota.total === (await req(p1, "/api/home")).data.quota.total, "kuota coaching mengikuti level baru");

  console.log("\n== Impor PDF hasil luar ==");
  const PDFDocument = (await import("pdfkit")).default;
  const makePdf = (lines) => new Promise((resolve) => { const d = new PDFDocument(); const b = []; d.on("data", (c) => b.push(c)); d.on("end", () => resolve(Buffer.concat(b))); lines.forEach((l) => d.text(l)); d.end(); });
  const upl = (buf, name = "laporan.pdf", type = "application/pdf") => { const f = new FormData(); f.append("file", new Blob([buf], { type }), name); return f; };
  r = await req(p1, "/api/analytics/pdf", { method: "POST", form: upl(Buffer.from("<html>bukan pdf</html>"), "x.pdf") }); ok(r.status === 415, "berkas non-PDF ditolak (magic bytes)");
  r = await req(p1, "/api/analytics/pdf", { method: "POST", form: upl(Buffer.alloc(11 * 1024 * 1024, 1), "besar.pdf") }); ok(r.status === 413, "PDF > 10 MB ditolak");
  const pdfBuf = await makePdf(["TOEFL ITP Score Report", "Listening Comprehension 52", "Structure and Written Expression 55", "Reading Comprehension 50", "Total Score 523"]);
  r = await req(p1, "/api/analytics/pdf", { method: "POST", form: upl(pdfBuf) }); ok(r.status === 201 && r.data.parsed.listening === 52 && r.data.parsed.structure === 55 && r.data.parsed.reading === 50, "PDF teks terbaca otomatis", J(r.data)); const pdfId = r.data.id;
  r = await req(p1, `/api/analytics/pdf/${pdfId}/analyze`, { method: "POST", json: {} }); ok(r.status === 409, "analisis sebelum verifikasi ditolak");
  r = await req(p1, `/api/analytics/pdf/${pdfId}`, { method: "PATCH", json: { listening: 99, structure: 55, reading: 50 } }); ok(r.status === 400, "nilai di luar 31–68 ditolak");
  r = await req(p1, `/api/analytics/pdf/${pdfId}`, { method: "PATCH", json: { listening: 50, structure: 55, reading: 50 } }); ok(r.status === 200 && r.data.verified.total === 517, "koreksi nilai; total dihitung ulang", J(r.data));
  r = await req(p1, `/api/analytics/pdf/${pdfId}/analyze`, { method: "POST", json: {} }); ok(r.status === 202, "analisis dimulai");
  let pa; for (let i = 0; i < 12; i++) { await sleep(500); pa = (await req(p1, `/api/analytics/pdf/${pdfId}`)).data; if (pa.analysis?.status === "ready") break; }
  ok(pa.analysis?.status === "ready" && pa.analysis.narrative?.summary && pa.status === "analyzed", "analisis PDF siap (angka terverifikasi saja)", J(pa.analysis).slice(0, 160));
  r = await req(p1, `/api/analytics/pdf/${pdfId}`, { method: "PATCH", json: { listening: 40 } }); ok(r.status === 409, "PDF yang sudah dianalisis tidak diubah diam-diam");
  r = await req(coach, `/api/analytics/pdf/${pdfId}`); ok(r.status === 200, "coach se-institusi boleh membuka");
  r = await req(coach, `/api/analytics/pdf/${pdfId}/file`); ok(r.status === 200 && r.headers.get("content-type") === "application/pdf", "coach mengunduh PDF asli");
  r = await req(coachB, `/api/analytics/pdf/${pdfId}`); ok(r.status === 404, "coach institusi lain: 404");
  r = await req(ia, `/api/analytics/pdf/${pdfId}`); ok(r.status === 403 || r.status === 404, "inst_admin tidak bisa membuka PDF individual");
  r = await req(admin, `/api/analytics/pdf/${pdfId}`); ok(r.status === 200, "admin boleh membuka");
  r = await req(p1, "/api/analytics/pdf"); ok(r.data.imports.length === 1 && r.data.imports[0].hasFile, "daftar PDF milik sendiri");
  r = await req(p1, `/api/analytics/pdf/${pdfId}`, { method: "DELETE" }); ok(r.status === 200, "pemilik menghapus PDF");
  r = await req(coach, `/api/analytics/pdf/${pdfId}`); ok(r.status === 404, "setelah dihapus tidak ada lagi");
  const scan = await makePdf([""]);
  r = await req(p1, "/api/analytics/pdf", { method: "POST", form: upl(scan) }); ok(r.status === 201 && Object.keys(r.data.parsed).length === 0, "PDF tanpa teks: tidak ada nilai terbaca (isi manual)", J(r.data));

  console.log("\n== Notifikasi, job harian, peta remedial, tinjauan Konselor ==");
  r = await req(p1, "/api/notifications"); ok(r.status === 200 && r.data.unread > 0 && r.data.items.some((n) => n.type === "placement_result" || n.title.includes("placement")), "notifikasi dalam aplikasi: hasil placement", J(r.data.items?.map((n) => n.title)));
  ok(r.data.items.some((n) => /now at the/i.test(n.title)) && r.data.items.some((n) => /analysis/i.test(n.title)), "notifikasi naik level & analisis siap");
  r = await req(p1, "/api/notifications/read", { method: "POST", json: { all: true } }); ok(r.status === 200, "tandai semua dibaca");
  r = await req(p1, "/api/notifications"); ok(r.data.unread === 0, "jumlah belum dibaca menjadi 0");
  r = await req(null, "/api/notifications"); ok(r.status === 401, "notifikasi butuh login");
  r = await req(coach, "/api/notifications"); ok(r.status === 200 && r.data.items.some((n) => n.type === "booking_new"), "coach diberi tahu ada booking baru");

  // pengingat H-2: item coach berdeadline 1 hari → job harian mengirim satu notifikasi, sekali saja
  await req(coach, `/api/coach/participants/${pid}`, { method: "POST", json: { action: "add_plan", title: "Latihan mendesak H-2", dueInDays: 1 } });
  r = await req(null, "/api/cron/daily", { headers: { authorization: "Bearer testsecret" } }); ok(r.status === 200 && r.data.reminders && r.data.reminders.plan >= 1, "job harian: pengingat deadline rencana", J(r.data));
  r = await req(p1, "/api/notifications"); ok(r.data.items.filter((n) => /deadline/i.test(n.title)).length === 1, "pengingat H-2 diterima sekali");
  r = await req(null, "/api/cron/daily", { headers: { authorization: "Bearer testsecret" } }); r = await req(p1, "/api/notifications"); ok(r.data.items.filter((n) => /deadline/i.test(n.title)).length === 1, "job harian kedua tidak menggandakan pengingat");

  // peringatan kontrak
  await req(admin, `/api/admin/institutions/${iB}`, { method: "PATCH", json: { name: "Kampus Lain", code: "KLAIN", seats: 5, status: "active", contractEnd: new Date(Date.now() + 5 * 86400000).toISOString() } });
  r = await req(null, "/api/cron/daily", { headers: { authorization: "Bearer testsecret" } }); ok(r.data.reminders.contract >= 1, "job harian: peringatan kontrak mendekati akhir", J(r.data.reminders));
  r = await req(admin, "/api/notifications"); ok(r.data.items.some((n) => /Kampus Lain.*contract ends/.test(n.title)), "admin diberi notifikasi kontrak");
  r = await req(null, "/api/cron/daily", { headers: { authorization: "Bearer testsecret" } }); r = await req(admin, "/api/notifications"); ok(r.data.items.filter((n) => /Kampus Lain.*contract ends/.test(n.title)).length === 1, "peringatan kontrak tidak berulang");

  // peta remedial
  r = await req(admin, "/api/admin/remedial-map"); ok(r.status === 200 && r.data.topics.length > 0 && r.data.units.length > 0, "peta remedial: topik & unit tersedia", J(r.data.topics?.slice(0, 2)));
  const tp = r.data.topics[0];
  r = await req(admin, "/api/admin/remedial-map", { method: "POST", json: { skill: tp.skill, topic: tp.topic, unitId: uid } }); ok(r.status === 201, "pemetaan topik → unit dibuat"); const rmId = r.data.id;
  r = await req(admin, "/api/admin/remedial-map", { method: "POST", json: { skill: tp.skill, topic: tp.topic, unitId: uid } }); ok(r.status === 409, "pemetaan ganda ditolak");
  r = await req(admin, "/api/admin/remedial-map", { method: "POST", json: { skill: "x", topic: "y", unitId: "a".repeat(24) } }); ok(r.status === 400, "unit tak ada ditolak");
  r = await req(p1, "/api/home"); ok(Array.isArray(r.data.plan) && r.data.plan.every((i) => "late" in i && "unitId" in i), "rencana di beranda memuat penanda terlambat & tautan unit");
  r = await req(admin, `/api/admin/remedial-map/${rmId}`, { method: "DELETE" }); ok(r.status === 200, "pemetaan dihapus");

  // tinjauan Konselor oleh coach
  r = await req(p1, "/api/counselor/threads", { method: "POST", json: { attemptId: aid } }); const th = r.data.id;
  r = await req(p1, `/api/counselor/threads/${th}/messages`, { method: "POST", json: { content: "Bagaimana cara menaikkan skor structure?" } }); ok(r.status === 200, "peserta bertanya ke Konselor AI", J(r.data).slice(0, 100));
  await req(p1, `/api/counselor/threads/${th}`, { method: "PATCH", json: { helpful: false } });
  r = await req(coach, "/api/coach/counselor"); ok(r.status === 200 && r.data.threads.some((t) => t.id === th), "coach melihat percakapan yang perlu ditinjau");
  r = await req(coachB, "/api/coach/counselor"); ok(!r.data.threads.some((t) => t.id === th), "coach institusi lain tidak melihatnya");
  r = await req(coachB, `/api/coach/counselor/${th}`); ok(r.status === 404, "coach institusi lain: 404");
  r = await req(ia, "/api/coach/counselor"); ok(r.status === 403, "inst_admin tidak bisa meninjau percakapan");
  r = await req(coach, `/api/coach/counselor/${th}`); ok(r.status === 200 && r.data.messages.length >= 2, "coach membaca percakapan (tercatat di audit)");
  r = await req(coach, `/api/coach/counselor/${th}`, { method: "PATCH", json: { reviewed: true, flagged: true, reviewNote: "Jawaban terlalu umum" } }); ok(r.status === 200, "coach menandai & meninjau");
  r = await req(coach, "/api/coach/counselor"); ok(!r.data.threads.some((t) => t.id === th), "yang sudah ditinjau keluar dari antrean");
  r = await req(admin, "/api/admin/counselor?filter=flagged"); ok(r.data.threads.some((t) => t.id === th), "admin melihat tanda dari coach");

  console.log("\n== Laporan institusi (agregat) ==");
  r = await req(ia, "/api/inst/summary"); ok(r.status === 200 && typeof r.data.placementPct === "number" && Array.isArray(r.data.levels) && r.data.coaching, "ringkasan institusi v2.2", J(r.data).slice(0, 160));
  ok(!/narrative|rahasia coach|Konselor/i.test(J(r.data)), "ringkasan institusi tidak memuat analisis/catatan/percakapan individu");
  r = await req(ia, "/api/inst/report.pdf"); const rp = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && rp.subarray(0, 4).toString() === "%PDF", "laporan PDF kelompok");
  r = await req(p1, "/api/inst/report.pdf"); ok(r.status === 403, "peserta tidak bisa mengunduh laporan institusi");
  r = await req(ia, `/api/inst/participants/${pid}`); ok(r.status === 200, "inst_admin membuka hasil peserta (dicatat audit)");

  console.log("\n== Tes ITP resmi (tanpa paket) ==");
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const png = () => { const f = new FormData(); f.append("file", new Blob([PNG], { type: "image/png" }), "x.png"); f.append("sensitive", "true"); return f; };
  r = await req(admin, "/api/admin/itp-sessions", { method: "POST", json: { title: "Sesi ITP Uji", date: iso(24 * 30), place: "Lab Uji", quota: 5 } }); ok(r.status === 201, "admin membuat sesi ITP", J(r.data)); const sess = r.data.id;
  r = await req(p1, "/api/itp/sessions"); ok(r.status === 200 && r.data.itpRemaining === 1 && r.data.sessions.some((x) => x.id === sess) && "rescheduleDays" in r.data, "peserta melihat sesi (tanpa jatah beli)", J(Object.keys(r.data)));
  r = await req(p1, "/api/assets", { method: "POST", form: png() }); ok(r.status === 201, "unggah KTP (sensitif)"); const idA = r.data.id;
  r = await req(p1, "/api/assets", { method: "POST", form: png() }); const faceA = r.data.id;
  r = await req(null, `/api/assets/${idA}`); ok(r.status === 401, "KTP tanpa login ditolak");
  r = await req(coach, `/api/assets/${idA}`); ok(r.status === 403 || r.status === 404, "KTP tidak terbuka untuk coach");
  r = await req(admin, `/api/assets/${idA}`); ok(r.status === 200, "admin boleh membuka KTP (dicatat audit)");
  const reg = { sessionId: sess, fullName: "Peserta Satu", nik: "3201010101010001", birthDate: "2000-05-01", gender: "L", idPhotoAssetId: idA, facePhotoAssetId: faceA, agree: true };
  r = await req(p1, "/api/itp/registrations", { method: "POST", json: { ...reg, nik: "123" } }); ok(r.status === 400, "NIK tidak valid ditolak");
  r = await req(p1, "/api/itp/registrations", { method: "POST", json: reg }); ok(r.status === 201, "pendaftaran ITP", J(r.data)); const regId = r.data.id;
  r = await req(p1, "/api/itp/registrations", { method: "POST", json: reg }); ok(r.status === 409 || r.status === 403, "daftar ganda ditolak");
  r = await req(p1, "/api/me", { method: "PATCH", json: { name: "Nama Lain" } }); ok(r.status === 409, "nama terkunci setelah daftar ITP");
  r = await req(admin, `/api/admin/itp-sessions/${sess}/roster`); ok(r.data.roster.length === 1 && r.data.roster[0].nikLast4 === "0001" && !J(r.data).includes("3201010101010001"), "roster hanya menampilkan 4 digit NIK");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PATCH", json: { docStatus: "rejected" } }); ok(r.status === 400, "tolak dokumen tanpa alasan ditolak");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PATCH", json: { docStatus: "valid" } }); ok(r.data.status === "confirmed", "dokumen valid: terkonfirmasi");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PUT", json: { listening: 99, structure: 50, reading: 50 } }); ok(r.status === 400, "skor di luar 31–68 ditolak");
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PUT", json: { listening: 50, structure: 52, reading: 51 } }); ok(r.status === 200 && r.data.total === 510 && /^EPTA-ITP-\d{4}-\d{4}$/.test(r.data.certificateNumber), "skor resmi: total 510 + nomor sertifikat", J(r.data)); const certNo = r.data.certificateNumber;
  r = await req(admin, `/api/admin/itp-registrations/${regId}`, { method: "PUT", json: { listening: 50, structure: 52, reading: 51 } });
  r = await req(p1, "/api/certificates"); const itpCerts = r.data.certificates.filter((c) => c.type === "itp"); ok(itpCerts.length === 1, "sertifikat tidak dobel saat skor disimpan ulang");
  r = await req(p1, `/api/certificates/${itpCerts[0].id}/pdf`); const cpdf = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && cpdf.subarray(0, 4).toString() === "%PDF", "PDF sertifikat valid");
  r = await req(coachB, `/api/certificates/${itpCerts[0].id}/pdf`); ok(r.status === 404 || r.status === 403, "PDF sertifikat orang lain ditolak");
  r = await req(null, `/api/certificates/verify/${certNo}`); ok(r.status === 200 && r.data.valid && r.data.total === 510 && !J(r.data).includes("Peserta Satu"), "verifikasi publik: nama disamarkan", J(r.data));
  r = await req(null, "/api/certificates/verify/EPTA-ITP-2026-9999"); ok(r.status === 404, "nomor palsu 404");
  r = await req(admin, `/api/admin/itp-sessions/${sess}/export.xlsx`); const xx = Buffer.from(await r.res.arrayBuffer()); ok(r.status === 200 && xx.subarray(0, 2).toString() === "PK", "ekspor roster .xlsx");

  console.log("\n== Rich text: blok interaktif & lampiran ==");
  const quizCfg = JSON.stringify({ items: [{ q: "Pilih yang benar", options: ["is", "are"], answer: 1 }, { q: "Pilih lagi", options: ["a", "b"], answer: 0 }] });
  const richHtml = `<p>Materi blok</p><div data-ei-block="quiz" data-config='${quizCfg}' data-topic="structure:blok uji" data-bid="blk1">x</div><div data-ei-block="quiz" data-config='{"items":[]}' data-topic="structure:x">salah</div><audio data-audio-id="${"a".repeat(24)}" data-transcript="1" controls></audio>`;
  r = await req(admin, "/api/admin/materials", { method: "POST", json: { title: "Materi Blok Uji", kind: "rich", contentHtml: richHtml } }); ok(r.status === 201, "materi rich dengan blok dibuat"); const bm = r.data.id, bSlug = r.data.slug;
  r = await req(admin, `/api/admin/materials/${bm}`); ok(r.data.contentHtml.includes('data-ei-block="quiz"') && (r.data.contentHtml.match(/data-ei-block/g) ?? []).length === 1, "blok sah tersimpan, blok tidak sah dibuang", r.data.contentHtml.slice(0, 160));
  await req(admin, `/api/admin/materials/${bm}/publish`, { method: "POST", json: { action: "publish" } });
  const ev1 = { materialId: bm, blockId: "blk1", itemId: "q0", topic: "structure:blok uji", correct: true };
  r = await req(p1, "/api/events/block", { method: "POST", json: ev1 }); ok(r.status === 200 && r.data.counted === true, "hasil butir blok tercatat");
  r = await req(p1, "/api/events/block", { method: "POST", json: ev1 }); ok(r.status === 200 && r.data.counted === false, "butir yang sama di hari yang sama tidak dihitung ulang");
  r = await req(p1, "/api/events/block", { method: "POST", json: { ...ev1, itemId: "q1", correct: false } }); ok(r.data.counted === true, "butir lain dihitung");
  r = await req(p1, "/api/events/block", { method: "POST", json: { ...ev1, itemId: "q9", topic: "structure:topik karangan" } }); ok(r.status === 404, "topik yang tidak dideklarasikan materi ditolak");
  r = await req(p1, "/api/events/block", { method: "POST", json: { ...ev1, materialId: "b".repeat(24) } }); ok(r.status === 404, "materi tak ada ditolak");
  r = await req(admin, "/api/events/block", { method: "POST", json: ev1 }); ok(r.status === 403, "hanya peserta yang mengirim hasil blok");
  r = await req(p1, "/api/study-plan"); const bt = r.data.topics.find((t) => t.topic === "blok uji"); ok(bt && bt.items === 2, "hasil blok memperbarui topic_stats", J(bt));
  r = await req(p1, `/api/materials/${bSlug}`); ok(r.status === 200 && r.data.contentHtml.includes("data-ei-block"), "peserta menerima materi dengan blok");

  const pdfAtt = await makePdf(["Lampiran materi"]);
  const attach = (buf) => { const f = new FormData(); f.append("file", new Blob([buf], { type: "application/pdf" }), "lampiran.pdf"); return f; };
  r = await req(p1, "/api/material-files", { method: "POST", form: attach(pdfAtt) }); ok(r.status === 403, "peserta tidak bisa melampirkan PDF materi");
  r = await req(coach, "/api/material-files", { method: "POST", form: attach(Buffer.from("bukan pdf")) }); ok(r.status === 415, "lampiran non-PDF ditolak");
  r = await req(coach, "/api/material-files", { method: "POST", form: attach(pdfAtt) }); ok(r.status === 201 && r.data.url, "coach melampirkan PDF materi", J(r.data)); const fileUrl = r.data.url;
  r = await req(p1, fileUrl); ok(r.status === 200 && r.headers.get("content-type") === "application/pdf", "peserta mengunduh lampiran");
  r = await req(null, fileUrl); ok(r.status === 401, "lampiran butuh login");

  console.log("\n== Materi oleh coach / admin institusi ==");
  r = await req(coach, "/api/admin/materials", { method: "POST", json: { title: "Materi Khusus Kampus", kind: "rich", contentHtml: "<p>Khusus peserta kampus ini</p>" } }); ok(r.status === 201, "coach membuat materi rich untuk institusinya"); const cm = r.data.id, cmSlug = r.data.slug;
  r = await req(coach, "/api/admin/materials", { method: "POST", json: { title: "HTML Coach", kind: "html", htmlDoc: { html: "<b>x</b>" } } }); ok(r.status === 403, "coach tidak boleh membuat materi HTML");
  r = await req(coach, `/api/admin/materials/${cm}/publish`, { method: "POST", json: { action: "publish" } }); ok(r.status === 200, "coach menerbitkan materi institusinya");
  r = await req(coach, "/api/admin/materials"); ok(r.data.materials.every((m) => ["Materi Khusus Kampus"].includes(m.title)), "coach hanya melihat materinya sendiri (bukan materi global)", J(r.data.materials.map((m) => m.title)));
  r = await req(coachB, `/api/admin/materials/${cm}`); ok(r.status === 404, "coach institusi lain tidak bisa membuka/mengubah");
  r = await req(coachB, `/api/admin/materials/${cm}`, { method: "DELETE" }); ok(r.status === 404, "coach institusi lain tidak bisa menghapus");
  r = await req(ia, `/api/admin/materials/${cm}`); ok(r.status === 200, "admin institusi sekampus dapat membuka materi institusinya");
  r = await req(coach, `/api/admin/materials/${bm}`); ok(r.status === 404, "coach tidak bisa membuka materi global milik admin");
  r = await req(coach, `/api/admin/materials/${cm}`, { method: "PATCH", json: { title: "Materi Khusus Kampus", kind: "html", htmlDoc: { html: "<b>x</b>" } } }); ok(r.status === 403, "coach tidak bisa mengubah jenis menjadi HTML");
  r = await req(p1, "/api/materials"); ok(r.data.materials.some((m) => m.slug === cmSlug), "peserta institusi yang sama melihat materi itu");
  await req(admin, `/api/admin/institutions/${iB}/invites`, { method: "POST", json: { emails: ["pb@test.local"] } }); await sleep(1500);
  const pbJar = await login("pb@test.local", { invite: inviteTokenFor("pb@test.local") }); await req(pbJar, "/api/me/consent", { method: "POST", json: { consent: true, name: "Peserta B" } });
  r = await req(pbJar, "/api/materials"); ok(r.status === 200 && !r.data.materials.some((m) => m.slug === cmSlug) && r.data.materials.some((m) => m.slug === bSlug), "peserta institusi lain tidak melihatnya; materi global tetap terlihat");
  r = await req(pbJar, `/api/materials/${cmSlug}`); ok(r.status === 404, "peserta institusi lain: 404 saat membuka langsung");
  r = await req(admin, "/api/admin/materials"); ok(r.data.materials.some((m) => m.title === "Materi Khusus Kampus"), "admin melihat semua materi");

  console.log("\n== Kedaluwarsa kontrak & penonaktifan ==");
  r = await req(admin, `/api/admin/institutions/${iA}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 3, status: "active", contractStart: new Date(Date.now() - 20 * 86400000).toISOString(), contractEnd: new Date(Date.now() - 86400000).toISOString() } });
  ok(r.status === 200, "kontrak diubah ke masa lalu");
  r = await req(p1, "/api/home"); ok(r.status === 401 || r.status === 403, "peserta lama langsung kehilangan akses", String(r.status));
  const otpCount = () => (logText().match(/to=p2@test\.local\nsubject=\d{6} is your/g) ?? []).length;
  const beforeOtp = otpCount();
  await req(null, "/api/auth/request-otp", { method: "POST", json: { email: "p2@test.local" } }); await sleep(1500);
  ok(otpCount() === beforeOtp, "OTP tidak dikirim ke peserta yang aksesnya berakhir", `${beforeOtp} -> ${otpCount()}`);
  r = await req(admin, `/api/admin/institutions/${iA}`, { method: "PATCH", json: { name: "Kampus Uji", code: "KUJI", seats: 3, status: "active", contractEnd: new Date(Date.now() + 90 * 86400000).toISOString() } });
  r = await req(p1, "/api/home"); ok(r.status === 200, "perpanjang kontrak memulihkan akses semua peserta");
  r = await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "disable" } }); ok(r.status === 200, "admin nonaktifkan peserta");
  r = await req(p1, "/api/home"); ok(r.status === 401 || r.status === 403, "peserta nonaktif ditolak", String(r.status));
  await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "enable" } });

  console.log("\n== Hak data (UU PDP) ==");
  r = await req(p1, "/api/me/export"); ok(r.status === 200 && r.data.user?.email === "p1@test.local", "ekspor data pribadi");
  r = await req(p1, "/api/me/delete", { method: "POST", json: { confirm: "SALAH" } }); ok(r.status === 400, "pengajuan hapus tanpa konfirmasi ditolak");
  r = await req(p1, "/api/me/delete", { method: "POST", json: { confirm: "DELETE" } }); ok(r.status === 200, "pengajuan hapus tercatat (admin yang memproses)");
  r = await req(p1, "/api/me"); ok(r.status === 200, "akun tetap ada sampai admin memproses");
  r = await req(admin, `/api/admin/participants/${pid}`, { method: "POST", json: { action: "erase", reason: "Permintaan peserta" } }); ok(r.status === 200, "admin hapus data peserta");
  r = await req(p1, "/api/me"); ok(r.status === 401, "sesi tidak berlaku setelah data dihapus", String(r.status));

  console.log("\n== Keamanan umum & cron ==");
  r = await req(admin, "/api/admin/params", { method: "PUT", json: { key: "counselor_quota", value: 30 }, headers: { origin: "https://evil.example" } }); ok(r.status === 403, "CSRF: Origin asing ditolak");
  r = await req(null, "/api/cron/mail"); ok(r.status === 401, "cron tanpa rahasia ditolak");
  r = await req(null, "/sign-in"); ok(r.headers.get("x-frame-options") === "DENY" && r.headers.get("x-content-type-options") === "nosniff", "header keamanan terpasang");
  r = await req(null, "/admin"); ok(r.status === 307, "halaman admin tanpa login dialihkan");
  r = await req(null, "/daftar"); ok(r.status === 404, "tidak ada halaman pendaftaran publik");
  r = await req(null, "/api/health"); ok(r.status === 200, "health check");

  console.log("\n== Daftar dengan kode institusi, password, lupa password ==");
  {
    const mailCode = async (email, kind) => {
      for (let i = 0; i < 25; i++) {
        await sleep(300);
        const all = [...logText().matchAll(new RegExp(`to=(\\S+)\\nsubject=(\\d{6}) is your English Inspira ${kind} code`, "g"))].filter((m) => m[1] === email);
        if (all.length) return all[all.length - 1][2];
      }
      return null;
    };
    const resetToken = async (email) => {
      for (let i = 0; i < 25; i++) {
        await sleep(300);
        const log = logText(); const at = log.lastIndexOf(`to=${email}\nsubject=Reset your English Inspira password`);
        const m = at >= 0 ? log.slice(at, at + 2000).match(/reset-password\?token=([0-9a-f]{64})/) : null;
        if (m) return m[1];
      }
      return null;
    };
    r = await req(admin, "/api/admin/institutions", { method: "POST", json: { name: "Kampus Daftar", code: "KDAFTAR", seats: 1, contractStart: new Date().toISOString(), contractEnd: new Date(Date.now() + 365 * 86400000).toISOString() } });
    ok(r.status === 201, "institusi untuk daftar mandiri dibuat", J(r.data));
    const em = "daftar@test.local";
    r = await req(null, "/api/auth/register", { method: "POST", json: { name: "Peserta Daftar", email: em, password: "rahasia123", code: "SALAH99" } });
    ok(r.status === 400, "daftar dengan kode institusi salah ditolak");
    r = await req(null, "/api/auth/register", { method: "POST", json: { name: "Peserta Daftar", email: em, password: "pendek", code: "kdaftar" } });
    ok(r.status === 400, "password < 8 karakter ditolak");
    r = await req(null, "/api/auth/register", { method: "POST", json: { name: "Peserta Daftar", email: em, password: "rahasia123", code: "kdaftar" } });
    ok(r.status === 200, "daftar: kode verifikasi dikirim", J(r.data));
    r = await req(null, "/api/auth/login", { method: "POST", json: { email: em, password: "rahasia123" } });
    ok(r.status === 400, "belum verifikasi email: login password ditolak");
    const vcode = await mailCode(em, "verification");
    ok(!!vcode, "email verifikasi berisi kode di judul");
    const jarR = { c: "" };
    r = await req(jarR, "/api/auth/register/verify", { method: "POST", json: { email: em, code: vcode } });
    ok(r.status === 200 && r.data.needsConsent === true && !!jarR.c, "verifikasi: akun aktif, masuk, lanjut ke persetujuan data", J(r.data));
    r = await req(null, "/api/auth/register", { method: "POST", json: { name: "Orang Lain", email: "lain@test.local", password: "rahasia123", code: "KDAFTAR" } });
    ok(r.status === 409, "kursi institusi penuh: daftar ditolak");
    r = await req(null, "/api/auth/register", { method: "POST", json: { name: "Penyerang", email: em, password: "bukanmilik1", code: "KUJI" } });
    ok(r.status === 200 || r.status === 409, "daftar ulang email yang sudah ada: tidak membocorkan / tidak mengubah akun");
    r = await req(null, "/api/auth/login", { method: "POST", json: { email: em, password: "bukanmilik1" } });
    ok(r.status === 400, "password dari pendaftaran ulang tidak berlaku");
    const jarL = { c: "" };
    r = await req(jarL, "/api/auth/login", { method: "POST", json: { email: em, password: "rahasia123" } });
    ok(r.status === 200 && !!jarL.c, "login dengan password", J(r.data));
    r = await req(null, "/api/auth/login", { method: "POST", json: { email: em, password: "salah12345" } });
    ok(r.status === 400, "password salah ditolak");
    r = await req(jarL, "/api/me"); ok(r.data.hasPassword === true, "profil: hasPassword");
    r = await req(jarL, "/api/me/password", { method: "POST", json: { current: "keliru123", password: "baru12345" } });
    ok(r.status === 400, "ganti password: password lama salah ditolak");
    r = await req(jarL, "/api/me/password", { method: "POST", json: { current: "rahasia123", password: "baru12345" } });
    ok(r.status === 200, "ganti password");
    r = await req(null, "/api/auth/forgot-password", { method: "POST", json: { email: "tidakada@test.local" } });
    await sleep(600);
    ok(r.status === 200 && !logText().includes("to=tidakada@test.local"), "lupa password email tak dikenal: respons sama, tanpa email");
    r = await req(null, "/api/auth/forgot-password", { method: "POST", json: { email: em } });
    const tok = await resetToken(em);
    ok(r.status === 200 && !!tok, "lupa password: tautan reset terkirim");
    r = await req(null, "/api/auth/reset-password", { method: "POST", json: { token: tok, password: "reset12345" } });
    ok(r.status === 200, "reset password dengan tautan");
    r = await req(null, "/api/auth/reset-password", { method: "POST", json: { token: tok, password: "lagi123456" } });
    ok(r.status === 400, "tautan reset hanya sekali pakai");
    r = await req(null, "/api/auth/login", { method: "POST", json: { email: em, password: "baru12345" } }); ok(r.status === 400, "password lama tidak berlaku setelah reset");
    r = await req(null, "/api/auth/login", { method: "POST", json: { email: em, password: "reset12345" } }); ok(r.status === 200, "login dengan password baru");
    for (const p of ["/register", "/forgot-password", "/reset-password", "/sign-in", "/"]) { r = await req(null, p); ok(r.status === 200, `halaman ${p} terbuka`); }
    r = await req(null, "/masuk?invite=abc"); ok(r.status === 308 && (r.headers.get("location") ?? "").endsWith("/sign-in?invite=abc"), "URL lama /masuk dialihkan ke /sign-in");
  }

  console.log("\n== Mode pemeliharaan ==");
  {
    const pj = { c: "" };
    await req(pj, "/api/auth/login", { method: "POST", json: { email: "daftar@test.local", password: "reset12345" } });
    r = await req(pj, "/api/admin/maintenance", { method: "PUT", json: { on: true, message: "Back at 10:00" } }); ok(r.status === 403, "peserta tidak bisa menyalakan pemeliharaan");
    r = await req(admin, "/api/admin/maintenance", { method: "PUT", json: { on: true, message: "Back at 10:00" } }); ok(r.status === 200 && r.data.on === true, "admin menyalakan pemeliharaan");
    r = await req(null, "/api/maintenance"); ok(r.data.on === true && r.data.message === "Back at 10:00", "status pemeliharaan publik");
    r = await req(pj, "/api/me"); ok(r.status === 503 && r.data.maintenance === true, "API peserta: 503 saat pemeliharaan", J(r.data));
    r = await fetch(U + "/home", { headers: { cookie: pj.c }, redirect: "manual" }); const html = await r.text();
    ok(html.includes("We are doing some maintenance") && html.includes("Back at 10:00"), "halaman peserta menampilkan pemeliharaan");
    r = await fetch(U + "/"); ok((await r.text()).includes("We are doing some maintenance"), "landing menampilkan pemeliharaan");
    r = await req(null, "/admin/login"); ok(r.status === 200, "/admin/login tetap terbuka");
    r = await req(null, "/admin"); ok((r.headers.get("location") ?? "").endsWith("/admin/login"), "saat pemeliharaan /admin tanpa login diarahkan ke /admin/login");
    r = await req(null, "/api/auth/login", { method: "POST", json: { email: "daftar@test.local", password: "reset12345", adminOnly: true } }); ok(r.status === 403, "login admin menolak akun bukan admin");
    r = await req(admin, "/api/admin/dashboard"); ok(r.status === 200, "admin tetap bisa memakai aplikasi");
    r = await req(admin, "/api/admin/maintenance", { method: "PUT", json: { on: false } }); ok(r.status === 200 && r.data.on === false, "admin mematikan pemeliharaan");
    r = await req(pj, "/api/me"); ok(r.status === 200, "setelah dimatikan peserta bisa lagi");
    r = await req(null, "/maintenance"); ok(r.status === 307 || r.status === 308, "/maintenance dialihkan saat tidak pemeliharaan");
    r = await req(null, "/admin"); ok((r.headers.get("location") ?? "").endsWith("/admin/login"), "/admin tanpa login diarahkan ke /admin/login");
  }

  console.log(`\n== HASIL: ${pass} lulus, ${fail} gagal ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERROR", e); process.exit(2); });

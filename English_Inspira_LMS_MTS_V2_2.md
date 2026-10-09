# English Inspira LMS — Master Technical Specification v2.2 (MTS)

Versi 2.2 · Pembaruan dari MTS v2.1 · LMS persiapan TOEFL ITP berbasis level, kerja sama institusi mitra, tanpa jalur komersial

## 0. Riwayat Perubahan

| Versi | Perubahan utama |
| --- | --- |
| 2.0 | Peralihan ke model institusi mitra, role coach, analitik berkelanjutan, dan penghapusan alur komersial. |
| 2.1 | Penegasan bahwa coach adalah penentu jadwal dan peserta hanya memilih slot yang telah diterbitkan. |
| 2.2 | Perubahan keamanan materi HTML: JavaScript materi tidak lagi dijalankan di origin/hak aplikasi utama. Materi interaktif dijalankan dalam iframe sandbox terisolasi dengan CSP ketat dan jembatan analitik terbatas. |

## 0.1 Perubahan dari v1

| Area | v1 | v2.2 |
| --- | --- | --- |
| Model bisnis | Jual paket ke publik (Midtrans, voucher, keranjang) | **Tanpa pembayaran.** Peserta masuk lewat institusi mitra |
| Pendaftaran | Publik + free trial | **Hanya diundang atau diimpor.** Tidak ada pendaftaran publik |
| Acuan level | Skor ITP | Skor ITP saja (**tanpa CEFR**), dibagi Basic / Intermediate / Advanced |
| Role | participant, admin, inst\_admin | Ditambah **coach** |
| Belajar | Materi datar | Level → course → unit, syarat lulus, aturan naik level |
| Coaching | Tidak ada | Slot dibuat coach, booking, kuota 8/4/2, kehadiran, catatan sesi |
| Analisis | Setelah submit tes | **Setiap selesai mengerjakan**, akumulatif, narasi, study plan berdeadline |
| Mesin analitik | Claude API | **pure-analytics** (menghitung) + Claude API (narasi) + upload PDF |
| Materi HTML | iframe sandbox | **iframe sandbox terisolasi, CSP ketat, tanpa akses langsung ke origin aplikasi** |
| ITP resmi dan sertifikat | Inti produk | **Opsional** (Fase 9) |

**Dihapus:** koleksi `products`, `vouchers`, `orders`, `leads`; Midtrans dan webhook; free trial; layar paket, keranjang, checkout, riwayat transaksi; modul admin transaksi, paket, voucher.

## 1. Ringkasan Produk

Alur peserta:

**Login OTP → Placement test (format ITP) → Level → Kuota coaching + study plan awal → Belajar course dan kuis (hasil dan analisis muncul setiap selesai mengerjakan) → Sesi coaching → Simulasi ITP berkala → Naik level → (opsional) ITP resmi dan sertifikat**

Tiga jalur di atas satu fondasi:

| Lapisan | Isi |
| --- | --- |
| Fondasi | Akun OTP, RBAC, institusi, enrollment, bank soal bertag, mesin tes, audio, aset, audit log |
| Jalur A: Tes ITP | Placement test, simulasi berkala, skor 310-677, proctoring ringan |
| Jalur B: Belajar mandiri | Level → course → unit → materi dan kuis → syarat lulus |
| Jalur C: Coaching | Slot coach, booking, kuota, kehadiran, catatan sesi |
| Otak analitik | Event tracking, analisis, narasi, pemetaan remedial, study plan, Konselor AI |

## 2. Keputusan Teknis Wajib

| Area | Keputusan |
| --- | --- |
| Database | **MongoDB** (Atlas atau self-hosted), ODM Mongoose. **GridFS** untuk audio |
| Email | **Nodemailer + SMTP Gmail memakai App Password** (akun dengan 2-Step Verification) |
| Gambar dan aset | Dikompres dan dikonversi ke **base64** di klien, disimpan di koleksi `assets` MongoDB |
| Materi | Dua mode: **Rich Text sangat lengkap** (TipTap) atau **HTML interaktif** dalam iframe sandbox terisolasi |
| AI | Claude API (Anthropic): analisis hasil belajar, narasi dan sugesti, serta Konselor AI. Kunci hanya di server |
| Mesin analitik | **pure-analytics** (perhitungan angka dan akumulasi, bila dipakai). Analisisnya oleh Claude API, lihat bagian 13.5 dan 14 |
| Acuan level | Skor TOEFL ITP 310-677. **Tanpa CEFR** |
| Akses | Hanya peserta dari institusi mitra. **Tanpa pembayaran online** |

## 3. Stack

- **Frontend dan backend**: Next.js 14 (App Router) + TypeScript + Tailwind, satu repo, Route Handlers. Font Montserrat dan Poppins.
- **Auth**: OTP email 6 digit (kedaluwarsa 5 menit), lalu sesi JWT di cookie `httpOnly` (`jose`).
- **Editor materi**: TipTap (Rich Text) + CodeMirror (mode HTML).
- **Validasi dan pembatasan**: Zod, `rate-limiter-flexible`, `mongo-sanitize`.
- **Job dan reminder**: `node-cron` (BullMQ + Redis opsional bila antrean besar).
- **Keamanan materi HTML**: iframe `sandbox` dengan origin opaque, Content Security Policy (CSP), validasi payload `postMessage`, dan allowlist aset. Pemrosesan CSS untuk preview/editor boleh memakai `postcss` + `postcss-prefix-selector`, tetapi bukan sebagai batas keamanan.
- **Impor dan ekspor**: `papaparse` (CSV), `exceljs` (Excel), generator PDF untuk laporan.
- **PDF masuk**: `pdf-parse` (teks), OCR opsional untuk PDF hasil scan.

## 4. Peran dan Hak Akses (RBAC)

| Peran | Cakupan data | Fungsi utama |
| --- | --- | --- |
| `participant` | Datanya sendiri | Placement, course, kuis, simulasi, melihat dan booking slot coaching yang tersedia, hasil dan analisis, study plan, Konselor AI |
| `coach` | Peserta institusinya yang berada di kelas atau slotnya | Menentukan dan mengelola jadwal/slot coaching, kehadiran, profil peserta, laporan pra-sesi, catatan sesi, ubah study plan, rekomendasi naik level |
| `inst_admin` | Institusinya saja | Impor dan undang peserta, statistik agregat, daftar peserta (nama, level, skor estimasi, kehadiran, status plan), laporan |
| `admin` | Semua institusi | Semua konfigurasi, konten, bank soal, kelas, penugasan coach, monitoring, laporan, materi HTML interaktif terisolasi |

**Aturan wajib**

- `institutionId` wajib untuk `participant`, `coach`, `inst_admin`. Hanya `admin` tanpa institusi.
- Middleware `requireRole([...])` dan `scopeByInstitution(user)` dipanggil di **setiap** handler. Filter institusi wajib di level query, bukan hanya di UI.
- Satu coach melayani satu institusi. Coach yang melatih dua mitra memakai dua akun.
- `inst_admin` **tidak** melihat isi analisis individu dan catatan sesi (asumsi privasi, lihat bagian 25).
- Peserta hanya melihat slot dari coach dan kelas institusinya, sesuai levelnya.
- **Jadwal coaching ditentukan oleh coach.** Peserta tidak membuat jadwal, tidak mengatur jam coach, dan tidak mengirim booking waktu bebas; peserta hanya memilih slot yang telah diterbitkan coach dan masih tersedia.

## 5. Konfigurasi dan Level (Dapat Diubah Admin)

Semua angka di bawah **tidak ditulis mati di kode**. Disimpan di `levels` dan `config_params`, dikelola lewat halaman Parameter Sistem.

**levels** (angka adalah **placeholder**, ditetapkan pihak yang meminta)

| Level | Rentang skor ITP | Kuota coaching |
| --- | --- | --- |
| Basic | 310-459 | 8 |
| Intermediate | 460-542 | 4 |
| Advanced | 543-677 | 2 |

**config\_params** (nilai bawaan)

| Key | Nilai bawaan | Keterangan |
| --- | --- | --- |
| `score_conversion` | Tabel raw → 310-677 per section | **Wajib diverifikasi ke sumber resmi sebelum produksi** |
| `weakness` | lemah < 60, prioritas tinggi < 40, minimum 5 butir | Ambang kelemahan per topik |
| `unit_pass_score` | 70 | Syarat lulus kuis unit (dari bank soal) |
| `level_up` | Estimasi skor simulasi terakhir ≥ batas bawah level berikutnya **dan** semua remedial prioritas tinggi selesai | Coach dapat merekomendasikan atau menahan |
| `booking` | Daftar maks 12 jam sebelum sesi, batal atau izin maks 24 jam sebelum sesi | Aturan penjadwalan |
| `quota_rules` | Hadir dan absen tanpa izin: terpakai. Izin tepat waktu: tidak terpakai. Coach batal: tidak terpakai | Aturan kuota |
| `stuck` | Waktu > 2× median soal (min 20 sampel) atau 3 salah beruntun di topik yang sama | Deteksi stuck |
| `idle_timeout_sec` | 60 | Waktu tidak aktif tidak dihitung |
| `plan_deadline_days` | Prioritas tinggi 7, sedang 14 | Deadline otomatis study plan |
| `counselor_quota` | 30 pesan per bulan (placeholder) | Batas Konselor AI |

Override per institusi (`institutions.configOverrides`) disiapkan di skema tetapi **tidak dipakai di v2.0**.

## 6. Model Data MongoDB

Semua koleksi punya `_id`, `createdAt`, `updatedAt`. Koleksi bertanda (inst) menyimpan `institutionId` dan di-index `{institutionId, ...}`.

```
# Akun dan mitra
users          { email(unique), name, phone, role, institutionId, status:'invited'|'active'|'disabled',
                 currentLevelId, currentScoreEst, placementAttemptId, consentAt, lastLoginAt }
otps           { email, codeHash, expiresAt(TTL), attempts }
institutions   { name, code(unique), seats, contractStart, contractEnd, contactEmail, status, configOverrides? }
enrollments    { userId, institutionId, status, startsAt, expiresAt }          # sumber kebenaran akses
invitations    { email, institutionId, tokenHash, expiresAt(TTL), invitedBy, status }

# Konfigurasi
levels         { key, name, order, scoreMin, scoreMax, coachingQuota }
config_params  { key(unique), value, updatedBy }
remedial_map   { topic, unitIds[], priority }

# Soal dan tes
questions      { section:'listening'|'structure'|'reading', type, passageId?, groupId?, stem, options[], answerKey,
                 explanation, difficulty, tags:[{skill, topic}], assetIds[], status }       # tag dua tingkat WAJIB
passages       { section, title, bodyHtml, assetIds[] }
question_groups{ audioId, instruction, questionIds[] }
audios         { gridFsId, title, mime, size, durationSec, sha256, transcript, uploaderId, status }
tests          { name, kind:'placement'|'sim'|'practice'|'quiz', levelId?, sections:[{name, durationSec, questionIds[]}] }
attempts (inst){ userId, testId, unitId?, startedAt, finishedAt, answers:[{qid, firstChoice, choice, changes, timeSpentSec}],
                 scoreRaw, scoreEst, sectionScores, topicScores, proctorFlags[], analysisId }

# Belajar
courses        { levelId, title, slug, order, status }
units          { courseId, levelId, order, title, passScore, requiredItems:[{kind:'material'|'quiz', ref}] }
materials      { title, slug, type:'rich'|'html', unitId?, contentJson?, contentHtml?, htmlDoc?{html,css,js},
                 assetIds[], tags[], status:'draft'|'review'|'published', version, authorId, reviewedBy }
material_versions { materialId, version, snapshot, at, by }
unit_progress (inst) { userId, unitId, status, bestScore, attempts, timeSpentSec, completedAt }

# Analitik
learning_events (inst) { userId, type, refType, refId, topic, correct, timeMs, attemptNo, meta, at }
topic_stats (inst)     { userId, topic, answered, correct, score(akumulatif), avgTimeMs, lastAt }
analyses (inst)        { userId, trigger, sourceType, sourceId, summary, strengths[], weaknesses[], gapToNextLevel,
                         nextSteps[], narrative, engine, status }
study_plans (inst)     { userId, version, items:[{topic, unitId, target:{type,value}, dueAt,
                         status:'todo'|'doing'|'done'|'late', source:'auto'|'coach', doneAt}] }
pdf_imports (inst)     { uploaderId, userId?, fileAssetId, extracted, verified, status, analysisId? }
counselor_threads (inst){ userId, messages:[{role, content, at}], reviewed, flag }

# Coaching
classes (inst)         { name, levelId, coachId, capacity, status }
coach_slots (inst)     { coachId, classId, levelId, startsAt, endsAt, capacity, bookedCount, mode:'online'|'offline',
                         meetingUrl?, room?, status:'open'|'full'|'cancelled'|'done', createdBy, updatedBy?, publishedAt? }
bookings (inst)        { slotId, userId, status:'booked'|'cancelled'|'rescheduled', cancelledAt }
attendance (inst)      { bookingId, status:'present'|'absent'|'excused'|'coach_cancelled', markedBy, quotaEffect:'used'|'kept' }
coaching_quotas (inst) { userId, levelId, total, used }
session_notes (inst)   { bookingId, coachId, userId, note, focusTopics[], visibleToParticipant }

# Pendukung
assets   { ownerId, mime, size, width, height, dataBase64, sha256(unique sparse) }
mail_queue { to, template, data, status, tries, nextTryAt }
notifications { userId, type, payload, readAt }
audit_logs { actorId, action, target, meta, at }
```

**Aturan sistem**

- Akses selalu dicek dari `enrollments` (status dan `expiresAt`), bukan dari asumsi lain. Kerja sama berakhir → enrollment ikut berakhir.
- Skor estimasi dihitung **server-side** dari `score_conversion`.
- Pembaruan `coaching_quotas.used` dan `coach_slots.bookedCount` memakai **operasi atomik** (`$inc` dengan syarat), supaya dua peserta tidak merebut kursi terakhir.
- Jumlah peserta aktif per institusi tidak boleh melebihi `seats`.

## 7. Autentikasi dan Mailer (Google App Password)

**Setup Gmail**: aktifkan 2-Step Verification, buat App Password di *Google Account → Security → App passwords*, salin 16 karakter tanpa spasi.

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=noreply@domain-anda.com
MAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
MAIL_FROM=English Inspira <noreply@domain-anda.com>
```

```ts
// lib/mailer.ts
import nodemailer from 'nodemailer';
export const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST, port: +process.env.MAIL_PORT!, secure: true,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_APP_PASSWORD },
  pool: true, maxConnections: 3,
});
export const sendMail = (to: string, subject: string, html: string) =>
  mailer.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
```

**Alur OTP**

1. `POST /api/auth/request-otp`: **hanya email yang sudah terdaftar** (status `invited` atau `active` dan enrollment berlaku) yang dikirimi kode. Respons **selalu sama** untuk email dikenal maupun tidak, supaya daftar peserta tidak bisa ditebak.
2. Kode 6 digit dari `crypto.randomInt`, disimpan sebagai hash, kedaluwarsa 5 menit.
3. `POST /api/auth/verify-otp`: maksimal 5 percobaan, lalu terkunci. Sukses → cookie sesi `httpOnly; Secure; SameSite=Lax`.
4. Rate limit: 3 permintaan OTP per email per 10 menit, 10 per IP per jam.

**Antrean email.** Semua email lewat `mail_queue` dan worker cron, tidak boleh memblokir request. Percobaan ulang bertahap bila gagal.

> Gmail membatasi sekitar 500 email per hari untuk akun biasa. Impor satu angkatan dengan undangan massal bisa menghabiskannya, sehingga pengiriman undangan dijadwalkan bertahap (misal 100 per jam). Bungkus pengiriman di `sendMail()` agar bisa pindah ke SMTP lain tanpa mengubah kode lain.

**Template email**: OTP, undangan peserta, konfirmasi booking, pembatalan atau perubahan slot oleh coach, pengingat sesi (H-1), pengingat deadline study plan, peringatan kuota coaching hampir habis, hasil analisis siap.

## 8. Onboarding Peserta Lewat Institusi Mitra

Tidak ada halaman daftar publik. Cara peserta masuk:

| Cara | Pelaku | Catatan |
| --- | --- | --- |
| Impor CSV atau Excel | `inst_admin`, `admin` | Kolom: email, nama, telepon (opsional). Validasi format dan duplikat, tolak bila melebihi `seats`, tampilkan laporan baris gagal |
| Undangan email | `inst_admin`, `admin` | Tautan berumur 7 hari. Login pertama melengkapi profil dan **persetujuan data (UU PDP)** |
| Input manual | `admin` | Kasus khusus |

- Akun baru berstatus `invited`, menjadi `active` setelah login OTP pertama dan persetujuan data.
- Saat kontrak berakhir (`contractEnd`), enrollment kedaluwarsa dan login ditolak, data tetap tersimpan sesuai kebijakan retensi.
- Penonaktifan peserta tidak menghapus riwayat. Hak hapus data ditangani lewat prosedur admin yang tercatat di `audit_logs`.

## 9. Strategi Gambar Base64

Tujuan: tanpa storage file eksternal. Risiko: base64 membengkak sekitar 33% dan dokumen MongoDB maksimum **16 MB**.

1. **Kompres di klien**: canvas, sisi terpanjang maks 1280 px, WebP atau JPEG kualitas 0.8, target ≤ 300 KB (foto identitas ≤ 500 KB).
2. **Koleksi `assets` terpisah.** Dokumen lain hanya menyimpan `assetId`.
3. **Disajikan lewat** `GET /api/assets/:id` (decode ke biner), `Cache-Control: public, max-age=31536000, immutable`, `ETag = sha256`.
4. Deduplikasi dengan `sha256`. MIME diizinkan: `image/jpeg|png|webp|gif`. SVG ditolak atau disanitasi.
5. Aset sensitif hanya untuk pemilik dan admin, `Cache-Control: private, no-store`.
6. Listing aset **selalu** `.select('-dataBase64')`.
7. Gambar yang di-paste di editor materi otomatis menjadi `assets`, di HTML ditulis `<img src="/api/assets/ID">`.

## 10. Course dan Modul Materi

### 10.1 Struktur

**Level → Course → Unit → (Materi + Kuis)**. Satu unit bisa berisi campuran materi Rich Text, materi HTML, audio, dan kuis dari bank soal. Peserta hanya melihat course sesuai levelnya. Unit lulus bila semua `requiredItems` selesai **dan** kuis bank soal mencapai `unit_pass_score`.

Syarat lulus dan naik level **hanya** memakai skor yang dinilai server dari bank soal. Skor dari JS materi hanya dipakai untuk analisis dan rekomendasi.

### 10.2 Mode 1: Rich Text Editor (sangat lengkap)

Pemakai: `admin`, `coach`, `inst_admin`. Memakai TipTap, menyimpan `contentJson` (sumber) dan `contentHtml` (hasil render, disanitasi).

| Kelompok | Fitur |
| --- | --- |
| Teks | Heading, bold, italic, underline, strike, warna teks, highlight, rata teks, subscript, superscript, ukuran dan jenis font |
| Struktur | Daftar bernomor dan poin, checklist, tabel (gabung dan pisah sel), blockquote, garis pemisah, code block |
| Media | Gambar (drag, paste, otomatis ke `assets`), video YouTube, **audio** dengan transkrip, lampiran PDF |
| Blok interaktif bawaan | Kuis pilihan ganda, flashcard, fill-in-the-blank, drag-and-drop pencocokan, timer latihan, blok catatan dan tips |
| Penyusunan | Link, undo/redo, penghitung kata, layar penuh, pratinjau tampilan ponsel |

Setiap butir blok interaktif **wajib** membawa tag topik dan otomatis mengirim hasil ke `learning_events`. Sanitasi wajib saat simpan dan tampil: `sanitize-html` (server) dan DOMPurify (klien), dengan whitelist tag dan atribut.

### 10.3 Mode 2: HTML interaktif (iframe sandbox terisolasi)

Pemakai: **hanya `admin` pusat**. Admin dapat menulis atau menempel HTML, CSS, dan JavaScript untuk materi interaktif. Konten dijalankan dalam iframe terisolasi, **bukan disuntik ke DOM aplikasi utama**. Materi tetap dapat memiliki tombol, latihan, animasi, dan input interaktif, tetapi tidak memperoleh akses langsung ke cookie, storage, DOM, atau fungsi internal aplikasi.

**Prinsip keamanan wajib**

- Iframe memakai `sandbox="allow-scripts allow-forms"` tanpa `allow-same-origin`, `allow-top-navigation`, `allow-popups`, `allow-downloads`, atau izin lain kecuali ada kebutuhan yang ditinjau secara khusus.
- Dokumen iframe memakai CSP ketat. Baseline: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`. Jika aset aplikasi perlu ditampilkan, gunakan URL aset terkontrol melalui proxy aplikasi dan tambahkan host tersebut secara eksplisit ke directive yang sesuai setelah tinjauan keamanan.
- Skrip eksternal, `fetch`/XHR/WebSocket, navigasi keluar, form submission, pemuatan plugin/object/embed, dan koneksi ke host eksternal tidak diperbolehkan secara default. Kebutuhan integrasi eksternal harus melalui perubahan kebijakan keamanan yang ditinjau, bukan pengecualian bebas per materi.
- HTML/CSS/JS divalidasi saat simpan, ukuran file dan panjang kode dibatasi, serta versi materi dicatat. Sanitasi adalah pertahanan tambahan, bukan pengganti isolasi iframe.
- Jangan pernah menyisipkan token, cookie, secret, kredensial, data pribadi peserta, atau object aplikasi ke dalam dokumen iframe.
- Materi yang dipublikasikan melewati status draft → review → published. Perubahan yang dipublikasikan membuat versi baru dan mendukung rollback; aksi penulis, reviewer, publish, dan rollback dicatat ke `audit_logs`.

**Render dan komunikasi dengan aplikasi**

1. Server hanya mengirim konten materi yang telah diotorisasi untuk peserta dan institusinya. Respons API tidak menyertakan secret atau data peserta yang tidak diperlukan.
2. Frontend membuat iframe dengan atribut `sandbox` yang ditetapkan aplikasi dan memasukkan dokumen materi melalui `srcDoc`. Konten materi tidak boleh mengubah atribut sandbox atau kebijakan keamanan dari luar iframe.
3. Komunikasi analitik memakai `window.postMessage` dengan protokol pesan ber-versi, nonce acak khusus instance, dan daftar tipe pesan yang diizinkan. Parent memvalidasi `event.source` terhadap `iframe.contentWindow`, nonce, bentuk payload dengan Zod, panjang string, ID item, serta batas frekuensi. Karena origin iframe sandbox bersifat opaque (`null`), validasi tidak boleh bergantung pada `event.origin` saja.
4. Bridge yang tersedia hanya menyediakan event terstruktur seperti `report` dan `complete`. Bridge **tidak** menyediakan akses DOM parent, API jaringan, token autentikasi, database, atau fungsi umum untuk menjalankan kode.
5. Nilai dari iframe dianggap input tidak tepercaya. Server memvalidasi ulang setiap event; nilai `score` yang dilaporkan materi hanya untuk analitik formatif, tidak menentukan kelulusan unit, skor TOEFL, level, atau kuota.
6. Saat navigasi keluar, iframe di-unmount dan listener dibersihkan. Nonce lama menjadi tidak berlaku; event dari iframe yang sudah ditutup ditolak.

Contoh kontrak API materi (konseptual; implementasi harus memakai validasi runtime):

```ts
type MaterialBridgeMessage =
  | { version: 1; nonce: string; type: 'report'; itemId: string; topic: string; correct?: boolean; timeMs?: number; attempt?: number }
  | { version: 1; nonce: string; type: 'complete'; score?: number; total?: number };
```

Materi di dalam iframe dapat mengirim pesan melalui bridge terbatas yang disediakan aplikasi. Jangan mengekspos objek global `EI` yang memiliki kemampuan selain mengirim pesan terstruktur tersebut. Pesan hanya menjadi sinyal analitik dan tidak dipercaya sebagai bukti kelulusan.

## 11. Mesin Tes dan Audio Listening

**Jenis tes** (`tests.kind`): `placement` (sekali, format ITP penuh), `sim` (simulasi penuh berkala), `practice` (latihan per section atau topik, bebas ulang), `quiz` (penilaian unit, dinilai server).

- **Mulai tes**: server membuat `attempt` dan menetapkan `startedAt`. Timer **dipegang server**, klien hanya menampilkan.
- **Autosave** tiap perubahan (debounce 2 detik) ke `PATCH /api/attempts/:id`. Tangguh terhadap refresh dan koneksi putus, sisa waktu tidak berubah.
- **Pencatatan per soal**: `firstChoice`, `choice`, `changes` (berapa kali jawaban diganti), `timeSpentSec` (waktu idle dikurangi memakai `idle_timeout_sec`).
- **Submit atau waktu habis** → server menghitung skor raw → estimasi skala 310-677 per section dan total (`score_conversion`) → skor per topik dari tag soal → menulis `learning_events` dan memperbarui `topic_stats` → memicu analisis (bagian 13).
- **Proctoring ringan** untuk `placement` dan `sim`: catat `visibilitychange`, keluar fullscreen, paste, dan multi-tab sebagai `proctorFlags`. Admin meninjau di modul Review Proctoring.

### Audio listening (GridFS)

- Audio **tidak** di-base64. Disimpan di **GridFS** (bucket `audio`), metadata di `audios`. Satu audio dapat dipakai banyak soal lewat `question_groups`.
- **Upload** (`POST /api/audio`, multipart, streaming): ekstensi `.mp3` (opsional `.m4a`, `.wav`), MIME `audio/mpeg`, **magic bytes** (`ID3` atau frame sync `0xFFEx`), maks **15 MB**, durasi maks 10 menit (dibaca dengan `music-metadata`), `sha256` untuk deduplikasi. Audio yang masih dipakai soal tidak bisa dihapus.
- **Pemutaran**: `GET /api/audio/:id` mendukung HTTP Range. Akses butuh sesi dan `attempt` aktif, atau signed URL berumur 10 menit.
- **Mode tes**: audio diputar **sekali**, tanpa pause atau ulang. Server mencatat `playedAt` per `attempt` + `audioId`, permintaan kedua ditolak. Seek dinonaktifkan. Refresh di tengah audio melanjutkan dari posisi terakhir yang dilaporkan.
- **Mode latihan dan materi**: pemutar penuh (play, pause, ulang, kecepatan 0.75-1.25×) dan transkrip. Transkrip tes ditampilkan setelah tes selesai sebagai pembahasan.
- Sisi klien: preload audio berikutnya, deteksi gagal muat dengan opsi muat ulang (tidak dihitung pemutaran ulang bila belum ada byte yang diputar), dan uji perangkat audio sebelum tes dimulai.
- Pengunduhan langsung tidak ditawarkan (`controlsList=nodownload`). Ini menyulitkan, **bukan** perlindungan mutlak.

## 12. Placement Test, Level, dan Kenaikan Level

**Alur setelah login pertama**

1. Layar persiapan: cek audio dan koneksi.
2. Placement test format ITP (Listening, Structure, Reading), satu kali. Pengulangan hanya atas izin admin atau coach.
3. Server menghitung `scoreEst` lalu mencocokkan ke `levels` (rentang skor) → mengisi `users.currentLevelId` dan `currentScoreEst`.
4. Sistem otomatis membuat `coaching_quotas` (`total` = `levels.coachingQuota`: 8, 4, atau 2).
5. Analisis awal dan **study plan pertama** dibuat (bagian 13 dan 15).
6. Email hasil dikirim, dashboard menampilkan level, kuota, rencana, dan jadwal terdekat.

**Kenaikan level**

- Dievaluasi setelah setiap simulasi dan penyelesaian unit.
- Syarat (`level_up`): estimasi skor simulasi terakhir ≥ batas bawah level berikutnya **dan** semua remedial prioritas tinggi selesai.
- Coach dapat **merekomendasikan** naik atau **menahan** dengan alasan tertulis. Bila syarat terpenuhi dan tidak ditahan, level naik otomatis.
- Saat naik: `users.levelHistory` bertambah `{levelId, at, reason}`, course level baru terbuka, **kuota coaching baru dibuat sesuai level baru** (sisa kuota lama hangus), study plan dibuat ulang. Perlu dikonfirmasi (bagian 25).
- Untuk peserta di level tertinggi, tujuan akhir adalah skor target institusi atau (opsional) ITP resmi.

## 13. Tracking Perilaku dan Analisis

### 13.1 Event yang direkam (`learning_events`)

| Tipe | Isi utama | Dipakai untuk |
| --- | --- | --- |
| `question_answered` | topik, benar atau salah, `timeMs`, percobaan ke-n, `changes` | Skor topik, stuck, keraguan |
| `material_open` / `material_close` | materi, durasi aktif | Bagian yang lama dipahami, drop-off |
| `unit_started` / `unit_completed` | unit, jumlah percobaan, total waktu | Progres, kepatuhan |
| `quiz_submit` | skor, percobaan | Syarat lulus |
| `ei_report` / `ei_complete` | dari latihan interaktif materi (termasuk HTML) | Kelemahan dari latihan |
| `audio_play` | audio, posisi | Kebiasaan menyimak |
| `idle` | durasi | Koreksi waktu belajar |

Waktu belajar dihitung **aktif saja**: klien mengirim detak (heartbeat) selama halaman terlihat dan ada interaksi, berhenti setelah `idle_timeout_sec`.

### 13.2 Analisis akumulatif

Satu kuis kecil datanya sedikit, sehingga kelemahan **tidak** disimpulkan dari satu pengerjaan. `topic_stats` menyimpan skor akumulatif per topik:

`skor_baru = α × skor_pengerjaan + (1 − α) × skor_lama` (α bawaan 0.3, dapat diubah)

| Kondisi | Status topik |
| --- | --- |
| Butir terjawab < minimum (5) | `belum_cukup_data` (tidak dinilai) |
| skor ≥ 60 | `kuat` atau `cukup` |
| skor < 60 | `lemah` |
| skor < 40 | `prioritas` |

**Stuck**: waktu pengerjaan > 2× median soal tersebut (minimum 20 sampel), atau 3 salah beruntun di topik yang sama.

### 13.3 Kapan analisis muncul

**Setiap selesai mengerjakan**: placement, kuis, unit, simulasi, course remedial, dan impor PDF terverifikasi.

1. Event masuk → `topic_stats` diperbarui → angka dasar dihitung kode (bagian 13.5 dan 14).
2. Hasil angka disimpan di `analyses` dan **langsung ditampilkan** (skor, benar dan salah, pembahasan, topik lemah, soal yang membuat stuck).
3. Analisis oleh Claude API (kelemahan, penyebab, prioritas, narasi, sugesti) dibuat asinkron dan menyusul beberapa detik kemudian (`analyses.status`: `calculated` → `ready`).
4. Study plan diperbarui (bagian 15).

**Isi hasil**: (1) skor dan status lulus, (2) kuat dan lemah di mana, soal stuck, waktu pengerjaan, perbandingan dengan percobaan sebelumnya, (3) narasi, (4) sugesti apa yang dikerjakan berikutnya, (5) rencana belajar terbaru. Untuk tes ITP ditambah jarak ke batas level berikutnya, misal: skor 505, level Intermediate, batas Advanced 543, selisih 38 poin.

### 13.4 Analisis dan narasi oleh Claude API

Claude menerima hanya **hasil hitung terstruktur** (bukan data pribadi) dan menulis analisis, narasi, serta sugesti. Output JSON `{narrative, suggestions[]}` divalidasi Zod, diulang bila tidak valid. AI **tidak boleh mengarang angka** dan tidak menjanjikan skor. Bila API gagal, dipakai **template narasi** cadangan yang dikelola admin.

### 13.5 Analisis oleh Claude API (Anthropic)

Analisis hasil belajar dilakukan oleh **Claude API**, dipanggil dari server (`lib/ai.ts`, SDK `@anthropic-ai/sdk`) lewat job `jobs/analysis.ts`. Kunci API hanya di server.

| Tahap | Pelaku | Isi |
| --- | --- | --- |
| 1. Angka dasar | Kode aplikasi (deterministik) | Benar atau salah, skor per section, `topic_stats` akumulatif, deteksi stuck, jarak ke level berikutnya. **Angka tidak dibuat AI** |
| 2. Analisis | **Claude API** | Menafsirkan angka: kekuatan dan kelemahan, pola kesalahan, dugaan penyebab (konsep belum kuat, ragu-ragu, terburu-buru), prioritas, topik yang direkomendasikan, narasi, sugesti |
| 3. Rencana | Kode aplikasi | Memetakan topik rekomendasi ke unit lewat `remedial_map`, menentukan deadline, membatasi jumlah item |

**Input ke Claude** (JSON ringkas): level dan skor estimasi, `topic_stats`, butir yang salah atau lambat (topik, waktu, jumlah ganti jawaban), riwayat ringkas, ambang dari `config_params`, dan **daftar topik yang valid**. Tanpa nama, email, telepon, atau NIK. Peserta direferensikan dengan alias internal.

**Output** (JSON terstruktur, divalidasi Zod, diulang maksimal 2 kali bila tidak valid):

```ts
type AnalysisResult = {
  summary: string;
  strengths: { topic: string; evidence: string }[];
  weaknesses: { topic: string; severity: 'weak' | 'priority'; evidence: string; likelyCause: string }[];
  gapToNextLevel?: { points: number; target: number };
  recommendations: { topic: string; priority: 'high' | 'medium' }[];
  narrative: string;
  suggestions: string[];
};
```

**Aturan dan pengaman**

- Topik di luar daftar valid ditolak. Angka di narasi dicek terhadap input, dan yang tidak cocok membuat hasil diulang.
- AI tidak menjanjikan skor dan hanya membahas persiapan ITP, dalam bahasa Indonesia yang sederhana.
- **Dua tahap tampil**: angka langsung muncul (`calculated`), analisis menyusul (`ready`).
- **Biaya dan beban**: hasil di-cache berdasarkan hash input, ada batas laju per pengguna dan per institusi, dan kuis kecil dapat memakai model lebih ringan atau template, sedangkan placement, simulasi, dan unit memakai analisis penuh.
- **Cadangan**: bila API gagal atau timeout, angka tetap tampil, narasi memakai template, dan job diulang bertahap. Status `failed` terlihat di dashboard admin.
- **Pencatatan**: `analyses` menyimpan `engine`, nama model, versi prompt, dan penggunaan token untuk pemantauan biaya per institusi. Prompt dikelola dan diberi versi di `config_params`.
- **Model**: dibaca dari env `ANTHROPIC_MODEL`, tidak ditulis mati. Usulan awal `claude-sonnet-5-5` untuk analisis, dan `claude-haiku-5-5` bila volume tinggi dan biaya perlu ditekan.
- **Privasi**: data belajar teknis dikirim ke API Anthropic tanpa identitas. File PDF mentah tidak dikirim, hanya nilai terverifikasi. Pernyataan ini dimasukkan ke persetujuan data peserta dan perlu disepakati dengan mitra.

**Perlu konfirmasi**: apakah pure-analytics tetap dipakai sebagai pemasok angka (tahap 1), atau sudah memanggil Anthropic API sendiri. Bila yang kedua, pakai sebagai service dan pastikan tidak ada dua panggilan AI untuk satu hasil.

## 14. Integrasi pure-analytics (Dua Pintu Masuk)

> **Status: kontrak perlu dikonfirmasi.** Isi dan bahasa pemrograman modul pure-analytics belum dilihat. Bagian ini mendefinisikan **adapter** supaya mesin analitik tetap satu, apa pun bentuk akhirnya.

**Pembagian tugas**: pure-analytics **menghitung** (deterministik, opsional: skor per topik, akumulasi, stuck, jarak ke level berikutnya). Claude API melakukan analisis dan **menulis narasi** dari hasil hitung.

**Bentuk integrasi** (pilih satu saat modul dikonfirmasi): library yang dipanggil langsung dari `lib/analytics.ts`, atau **service terpisah** (`PURE_ANALYTICS_URL`, `POST /analyze`). Service terpisah dianjurkan bila bahasanya berbeda atau akan dipakai aplikasi lain.

```ts
// Format data standar (kontrak adapter)
type AnalysisInput = {
  subject: { userId: string; levelId: string; scoreEst?: number };
  source: { type: 'attempt' | 'unit' | 'material' | 'pdf'; id: string };
  items: { itemId: string; section?: string; topic: string; correct: boolean;
           timeMs?: number; attempt?: number; changes?: number }[];
  history: { topic: string; score: number; n: number }[];   // dari topic_stats
  config: { weakness: object; stuck: object; nextLevelMin?: number };
};
type AnalysisOutput = {
  sectionScores: Record<string, number>;
  topicScores: { topic: string; score: number; n: number;
                 status: 'strong' | 'ok' | 'weak' | 'priority' | 'insufficient' }[];
  stuckItems: { itemId: string; timeMs: number; reason: string }[];
  gapToNextLevel?: { points: number; target: number };
  recommendations: { topic: string; priority: 'high' | 'medium' }[];
};
```

|  | Pintu 1: Terintegrasi | Pintu 2: Upload PDF |
| --- | --- | --- |
| Sumber | Otomatis dari course, kuis, simulasi, materi | PDF dari luar (laporan skor tes atau latihan platform lain) |
| Adapter | `lmsAdapter` (dari `learning_events`, `attempts`, `topic_stats`) | `pdfAdapter` (dari hasil ekstraksi yang sudah diverifikasi) |
| Kedalaman | Penuh: waktu, percobaan, tag topik, stuck | Terbatas pada isi PDF (biasanya skor per section) |
| Tertaut ke | Profil, study plan, kuota coaching | Opsional ditautkan ke akun peserta |

**Alur upload PDF**

1. **Upload**: hanya PDF, cek magic bytes (`%PDF`), maks 10 MB, disimpan di GridFS bucket `pdf` (bukan base64, karena bisa mendekati batas 16 MB).
2. **Ekstraksi**: `pdf-parse` untuk PDF teks. PDF hasil scan memerlukan OCR (akurasi lebih rendah, opsional).
3. **Parser per template**: mulai dari satu atau dua format PDF yang jelas, tambah belakangan.
4. **Layar verifikasi**: nilai yang terbaca ditampilkan (misal Structure 52, Reading 48) dan **dapat dikoreksi** sebelum dianalisis, untuk mencegah analisis salah akibat salah baca.
5. **Analisis** lewat `pdfAdapter` → hasil, narasi, usulan study plan.
6. **Keamanan dan privasi**: file tidak pernah dikirim ke Claude, hanya nilai terstruktur yang sudah diverifikasi. Akses dibatasi pemilik, coach, dan admin. Retensi file diatur (bagian 25).

## 15. Study Plan (Rencana Belajar Berdeadline)

Dibuat dan diperbarui otomatis **setiap analisis selesai**.

1. Untuk tiap topik berstatus `weak` atau `priority`, cari course atau unit penunjang di `remedial_map`.
2. Buat item: `{topic, unitId, target, dueAt, status}`. Contoh target: selesaikan unit dan skor kuis ≥ 75, atau 3 latihan dengan skor ≥ 70.
3. Deadline otomatis dari `plan_deadline_days` (prioritas 7 hari, lemah 14 hari). Item aktif dibatasi (bawaan maks 5) agar peserta tidak kewalahan, diurutkan menurut prioritas.

| Peristiwa | Tindakan sistem |
| --- | --- |
| Remedial selesai dan topik membaik (≥ 60) | Item ditutup `done`, dilaporkan sebagai perbaikan |
| Muncul kelemahan baru | Item ditambahkan |
| Deadline terlewat | Status `late`, pengingat, tampil di dashboard coach |
| Coach menambah atau mengubah item | `source: coach`, **tidak ditimpa** pembaruan otomatis |

Setelah remedial selesai, analisis ulang mengukur apakah kelemahan benar-benar membaik. Hasilnya menjadi bukti progres dan masukan untuk kenaikan level.

## 16. Modul Coaching

**Alur**: coach menentukan dan menerbitkan slot → slot tampil pada kalender ketersediaan coach bagi peserta institusi dan level yang cocok → peserta memilih salah satu slot yang tersedia dan booking → sesi berjalan → coach mengisi kehadiran → kuota diperbarui → catatan sesi.

**Prinsip otoritas jadwal:** coach adalah satu-satunya pihak yang menetapkan waktu, durasi, kapasitas, mode, dan lokasi/link sesi. Peserta tidak dapat membuat slot, mengubah jadwal coach, atau mengajukan waktu bebas melalui booking. Jika peserta perlu pindah jadwal, ia membatalkan atau mengajukan perubahan sesuai kebijakan lalu memilih slot lain yang telah diterbitkan coach; permintaan perubahan tidak otomatis mengubah jadwal sesi.

### 16.1 Slot (dibuat coach)

- Coach membuat, mengubah, menerbitkan, dan membatalkan slot melalui kalender coach. Isi slot: tanggal, jam mulai dan selesai, kelas/level, kapasitas, mode (`online` atau `offline`), serta link meeting atau ruangan.
- Hanya coach pemilik slot atau admin berwenang yang boleh mengelola slot; semua perubahan dicatat di `audit_logs`. Peserta hanya memiliki akses baca ke kalender ketersediaan dan tidak dapat memanggil endpoint pengelolaan slot.
- **Cek bentrok** dilakukan di server: satu coach tidak boleh memiliki slot aktif yang waktunya beririsan. Waktu selesai harus lebih besar dari waktu mulai dan slot baru tidak boleh dibuat pada waktu lampau.
- Slot baru hanya bisa dibooking setelah diterbitkan (`publishedAt` terisi dan status `open`). Draft slot tidak terlihat oleh peserta.
- Perubahan waktu atau pembatalan slot memberi **notifikasi dan email** kepada peserta yang sudah booking. Pembatalan oleh coach tidak menghabiskan kuota peserta; peserta dapat memilih slot lain yang diterbitkan coach.

### 16.2 Booking

- Peserta hanya melihat slot yang telah diterbitkan dari kelas dan coach **institusinya**, untuk **levelnya**. Kalender peserta adalah kalender ketersediaan yang ditentukan coach, bukan alat untuk menyusun jadwal sendiri.
- Peserta hanya dapat memilih slot berstatus `open`, belum dimulai, belum penuh, dan masih dalam batas waktu (`booking`). Syarat kuota: `total − used − booking aktif > 0`; peserta juga tidak boleh memiliki booking lain yang waktunya beririsan.
- Booking/reschedule peserta hanya memilih slot yang sudah tersedia. Tidak ada endpoint atau UI peserta untuk membuat/mengubah `coach_slots`; permintaan perubahan jadwal, bila disediakan, berstatus permintaan dan menunggu keputusan coach, tanpa mengubah slot secara otomatis.
- Pemesanan kursi memakai operasi **atomik** agar tidak ada kursi ganda:

```ts
const slot = await CoachSlot.findOneAndUpdate(
  { _id, institutionId, levelId, status: 'open', $expr: { $lt: ['$bookedCount', '$capacity'] } },
  { $inc: { bookedCount: 1 } }, { new: true });
if (!slot) throw new Error('Slot penuh atau tidak tersedia');
```

### 16.3 Kehadiran dan kuota

| Kondisi | `attendance.status` | Kuota |
| --- | --- | --- |
| Peserta hadir | `present` | Terpakai |
| Absen tanpa izin | `absent` | Terpakai (hangus) |
| Izin sebelum batas 24 jam | `excused` | **Tidak** terpakai, boleh booking ulang |
| Izin lewat batas | `absent` | Terpakai |
| Coach membatalkan | `coach_cancelled` | **Tidak** terpakai, peserta dapat jadwal ulang |

Pembaruan `coaching_quotas.used` bersifat **idempoten**: satu `bookingId` hanya dapat mengubah kuota satu kali.

### 16.4 Laporan pra-sesi dan catatan

- **Laporan pra-sesi** otomatis untuk coach: level dan skor estimasi, topik lemah, soal yang sering salah, bagian yang membuat stuck, status study plan dan kepatuhan, catatan sesi sebelumnya.
- **Catatan sesi**: coach menulis feedback dan topik fokus, dengan opsi tampil ke peserta. Coach juga dapat mengubah study plan dan memberi rekomendasi naik level.
- **Pantauan admin**: peserta yang kuotanya **tidak mungkin habis** sebelum `contractEnd` (misal slot Basic terlalu sedikit), kehadiran coach, dan kepatuhan peserta.

## 17. Konselor AI

Hidup berdampingan dengan coach: AI untuk tanya jawab kapan saja, coach untuk sesi terjadwal. Keduanya membaca **satu sumber analisis yang sama**, sehingga saran tidak bertentangan.

- **Konteks**: profil, level, `analyses` terbaru, study plan, ringkasan attempt. Riwayat dipangkas ke N pesan terakhir plus ringkasan.
- **Guardrail**: hanya topik persiapan ITP, tidak menjanjikan skor, tidak mengubah study plan secara langsung (hanya mengusulkan, rencana resmi tetap oleh sistem atau coach), kuota pesan per bulan (`counselor_quota`).
- Admin dan coach dapat meninjau dan menandai jawaban buruk (`reviewed`, `flag`).
- Kunci API hanya di server, tidak pernah ke klien.

## 18. Notifikasi dan Job Terjadwal

| Job | Jadwal | Fungsi |
| --- | --- | --- |
| Mail worker | Tiap menit | Mengirim `mail_queue` dengan batas laju dan percobaan ulang |
| Analysis worker | Berbasis event | Narasi AI dan pembaruan study plan |
| Reminder sesi | Per jam | Email dan notifikasi H-1 sebelum sesi |
| Plan status | Harian | Menandai item `late`, mengirim pengingat H-2 deadline |
| Peringatan kuota | Harian | Kuota hampir habis atau tidak mungkin habis sebelum kontrak berakhir |
| Kontrak institusi | Harian | Mengakhiri `enrollments` yang kedaluwarsa, memberi peringatan sebelumnya |
| Pembersihan | Harian | Undangan dan file PDF kedaluwarsa |

Notifikasi dalam aplikasi (`notifications`) dan email memakai template yang sama.

## 19. Daftar API Utama

```
Auth        POST /api/auth/request-otp · verify-otp · logout · GET /api/me · POST /api/me/consent
Onboarding  POST /api/inst/participants/import · /invites · GET /api/inst/participants
Tes         GET /api/tests · POST /api/tests/:id/start · PATCH /api/attempts/:id
            POST /api/attempts/:id/submit · GET /api/attempts/:id/result
Placement   GET /api/placement/status · POST /api/placement/start
Belajar     GET /api/courses · GET /api/units/:id · GET /api/materials/:slug
            POST /api/materials/:id/progress · POST /api/events (batch heartbeat)
Analisis    GET /api/analyses · GET /api/analyses/:id · GET /api/topic-stats
Study plan  GET /api/plan · PATCH /api/plan/items/:id
Coaching    GET /api/slots (slot published yang sesuai institusi/level) · POST /api/bookings (pilih slot tersedia) · DELETE /api/bookings/:id · GET /api/quota
Coach       GET/POST/PATCH/DELETE /api/coach/slots (khusus coach pemilik/admin berwenang; create/edit/publish/cancel) · GET /api/coach/participants/:id/profile
            GET /api/coach/sessions/:id/brief · POST /api/coach/attendance · POST /api/coach/notes
            PATCH /api/coach/plan/:userId · POST /api/coach/level-recommendation
AI          POST /api/counselor/threads/:id/messages
PDF         POST /api/analytics/pdf (upload) · GET/PATCH /api/analytics/pdf/:id (verifikasi) · POST /api/analytics/pdf/:id/analyze
Aset/Audio  POST /api/assets · GET /api/assets/:id · POST /api/audio · GET /api/audio/:id (Range)
Admin       /api/admin/{dashboard,institutions,users,levels,params,questions,courses,units,materials,
            remedial-map,classes,coaches,monitoring,proctoring,counselor-review,reports,audit}
Institusi   /api/inst/{summary,participants,invites,reports}
```

Semua endpoint memakai `requireRole` dan `scopeByInstitution`. Endpoint penulisan materi `html` hanya untuk `admin`.

## 20. Keamanan

- Cookie `httpOnly; Secure; SameSite=Lax`, proteksi CSRF untuk mutasi. Zod untuk semua input, `mongo-sanitize` (cegah NoSQL injection), security headers (`helmet`).
- **Isolasi data antar mitra**: filter `institutionId` di level query pada setiap koleksi bertanda (inst), dengan **uji otomatis** bahwa `coach` dan `inst_admin` tidak dapat membaca institusi lain.
- **Materi HTML/JS** dianggap konten tidak tepercaya dan dijalankan hanya di iframe sandbox dengan origin opaque, CSP ketat, tanpa akses jaringan eksternal atau akses langsung ke origin aplikasi. Komunikasi melalui `postMessage` dengan nonce, validasi `event.source`, schema Zod, allowlist pesan, dan pembatasan frekuensi. Hanya `admin` pusat yang dapat menulis; wajib review, versioning, rollback, dan audit log. Tidak ada token atau secret di iframe. Uji keamanan wajib mencakup upaya akses parent DOM/storage/cookie, jaringan keluar, navigasi, popup, dan pemalsuan pesan.
- **UU PDP**: persetujuan data saat login pertama, tujuan dan retensi yang jelas, hak akses dan hapus, akses coach dan `inst_admin` ke data peserta dicatat di `audit_logs`.
- Data identitas (jika ITP resmi dipakai): enkripsi field (AES-256-GCM) untuk NIK, akses dibatasi dan dicatat.
- Secret hanya di environment, tidak di-commit. Backup MongoDB terjadwal (snapshot Atlas atau `mongodump` harian).

## 21. Struktur Proyek

```
english-inspira/
├─ app/
│  ├─ (public)/ masuk
│  ├─ (participant)/ beranda, placement, belajar, tes, hasil, rencana, coaching, konselor, profil
│  ├─ (coach)/coach/ slot, peserta, sesi, catatan
│  ├─ (admin)/admin/…     (inst)/institusi/…
│  └─ api/…               (route handlers sesuai bagian 19)
├─ lib/ db.ts, auth.ts, mailer.ts, rbac.ts, scoring.ts, levels.ts, analytics.ts (adapter),
│        ai.ts, scheduling.ts, quota.ts, plan.ts, sanitize.ts, css-scope.ts
├─ models/ (Mongoose schema per koleksi)
├─ components/ editor/, test-room/, material-root/, schedule/, ui/
├─ jobs/ mail.ts, analysis.ts, reminders.ts, plan-status.ts, contracts.ts
├─ scripts/ seed.ts
├─ .env.example · Dockerfile · docker-compose.yml
```

## 22. Build Instructions

**Prasyarat**: Node 20+, MongoDB Atlas (atau Docker), akun Gmail dengan App Password, API key Anthropic, modul pure-analytics (bentuk integrasi dikonfirmasi).

```bash
# 1. Inisialisasi
npx create-next-app@latest english-inspira --ts --tailwind --app
cd english-inspira
npm i mongoose zod jose bcryptjs nodemailer @anthropic-ai/sdk \
  music-metadata busboy sanitize-html isomorphic-dompurify rate-limiter-flexible node-cron \
  mongo-sanitize papaparse exceljs pdf-parse postcss postcss-prefix-selector \
  @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-table \
  @tiptap/extension-link @tiptap/extension-underline @tiptap/extension-text-align \
  @tiptap/extension-highlight @tiptap/extension-color @tiptap/extension-text-style \
  @tiptap/extension-subscript @tiptap/extension-superscript @tiptap/extension-task-list \
  @uiw/react-codemirror @codemirror/lang-html @codemirror/lang-css @codemirror/lang-javascript

# 2. Environment (.env.local)
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<acak 64 karakter>
APP_URL=http://localhost:3000
MAIL_HOST=smtp.gmail.com  MAIL_PORT=465  MAIL_SECURE=true
MAIL_USER=...  MAIL_APP_PASSWORD=...  MAIL_FROM=...
ANTHROPIC_API_KEY=...
PURE_ANALYTICS_URL=...      # bila berupa service
FIELD_ENCRYPTION_KEY=<32 byte base64>

# 3. Jalankan lokal
npm run dev
npm run seed   # level, parameter bawaan, institusi contoh, akun admin, soal dan unit contoh
```

**Deploy**: VPS (Docker + Nginx + HTTPS) atau Vercel. Atur semua env, pastikan job cron berjalan (VPS: proses terpisah, Vercel: Vercel Cron), dan siapkan backup database.

## 23. Fase Pengerjaan

| Fase | Isi | Hasil yang dapat diuji |
| --- | --- | --- |
| 1 | Fondasi: DB, model, RBAC (+coach), mailer dan antrean, OTP, institusi, enrollment, impor dan undangan | Peserta diundang dan login OTP |
| 2 | Bank soal bertag dua tingkat, aset base64, mesin tes, skor, audio listening, proctoring | Simulasi ITP sampai hasil |
| 3 | `levels`, `config_params`, placement test, penentuan level, kuota coaching awal | Placement → level dan kuota otomatis |
| 4 | Course bertingkat, materi (Rich Text + HTML sandbox), bridge analitik terbatas, event tracking | Belajar per unit, perilaku tercatat dan materi terisolasi |
| 5 | `topic_stats`, analisis setiap pengerjaan, adapter pure-analytics, narasi AI, `remedial_map`, study plan | Hasil, narasi, dan rencana berdeadline otomatis |
| 6 | Coaching: slot, cek bentrok, booking atomik, kuota, kehadiran, catatan, laporan pra-sesi, dashboard coach | Alur sesi sampai kuota berkurang |
| 7 | Upload PDF (verifikasi dan analisis), Konselor AI, aturan naik level | Dua pintu masuk analisis, level naik otomatis |
| 8 | Dashboard admin dan institusi, laporan PDF dan Excel, hardening, uji beban, backup, deploy | Semua peran, siap produksi |
| 9 (opsional) | ITP resmi: jadwal, pendaftaran, input skor oleh admin, sertifikat PDF | Daftar sampai sertifikat |

## 24. Kriteria Penerimaan

- OTP salah 5 kali terkunci, OTP kedaluwarsa ditolak, dan email tidak terdaftar mendapat respons yang sama dengan email terdaftar.
- Impor yang melebihi `seats` ditolak dan baris gagal dilaporkan.
- Refresh saat tes tidak mengubah sisa waktu dan tidak menghilangkan jawaban.
- Placement test menghasilkan level sesuai `levels`, dan kuota coaching terbentuk otomatis (8, 4, atau 2).
- Mengubah rentang level di Parameter Sistem langsung memengaruhi placement berikutnya tanpa mengubah kode.
- Hasil dan analisis muncul setelah **setiap** placement, kuis, unit, dan simulasi. Skor tampil langsung, narasi menyusul.
- Satu pengerjaan kecil tidak langsung menandai topik sebagai lemah (minimum sampel berlaku).
- Study plan diperbarui otomatis: topik membaik dicabut, kelemahan baru ditambah, item buatan coach tidak ditimpa.
- Dua peserta yang mem-booking kursi terakhir bersamaan: hanya satu berhasil. Coach tidak bisa membuat dua slot bentrok.
- Hanya coach pemilik slot atau admin berwenang yang dapat membuat, menerbitkan, mengubah, atau membatalkan jadwal; peserta tidak dapat membuat atau mengubah jadwal coach melalui UI maupun API.
- Peserta hanya melihat slot yang telah diterbitkan dan sesuai institusi/level; slot draft, penuh, batal, kedaluwarsa, atau yang waktunya sudah lewat tidak dapat dibooking.
- Perubahan/pembatalan oleh coach mengirim notifikasi kepada peserta terdampak; pembatalan coach tidak mengurangi kuota dan peserta hanya dapat memilih slot pengganti yang sudah diterbitkan.
- Kuota sesuai tabel kehadiran: absen tanpa izin terpakai, izin tepat waktu dan coach batal tidak terpakai. Pencatatan kehadiran ganda tidak mengurangi kuota dua kali.
- Peserta, coach, dan `inst_admin` tidak pernah dapat membaca data institusi lain (**uji otomatis**).
- Materi HTML interaktif berjalan hanya di iframe sandbox; tombol, input, dan animasi yang diizinkan berfungsi tanpa akses ke DOM/storage/cookie aplikasi, jaringan keluar, popup, atau navigasi parent. Uji harus membuktikan pesan palsu/nonce salah ditolak, event dari iframe lama ditolak, dan hanya `admin` pusat dapat menulis materi.
- Skor penentu lulus unit dan naik level hanya dari kuis bank soal.
- Upload mp3 valid tersimpan di GridFS, file non-mp3 yang diganti ekstensi ditolak. Audio mode tes hanya bisa diputar sekali per attempt.
- PDF yang diunggah wajib melewati layar verifikasi sebelum dianalisis, dan file PDF tidak dikirim ke AI.
- Gambar > 300 KB terkompres otomatis, dan listing aset tidak memuat `dataBase64`.

## 25. Asumsi dan Keputusan yang Masih Terbuka

| # | Hal | Asumsi di MTS v2 | Perlu konfirmasi |
| --- | --- | --- | --- |
| 1 | Angka `levels` (Basic, Intermediate, Advanced) | 310-459, 460-542, 543-677 (placeholder) | Pihak yang meminta |
| 2 | Tabel konversi raw → 310-677 | Disimpan sebagai konfigurasi | **Verifikasi ke sumber resmi** |
| 3 | Siapa yang mengimpor peserta | `inst_admin` dan `admin` | Pihak yang meminta |
| 4 | Parameter per mitra | Sama untuk semua (override disiapkan, tidak dipakai) | Mitra |
| 5 | Yang dilihat `inst_admin` | Statistik agregat dan daftar peserta, **tanpa** isi analisis individu dan catatan sesi | Mitra dan persetujuan data peserta |
| 6 | Aturan kuota | Sesuai tabel 16.3 | Pihak yang meminta |
| 7 | Kuota coaching saat naik level | Kuota baru sesuai level baru, sisa lama hangus | Pihak yang meminta |
| 8 | Bentuk pure-analytics (library atau service) dan format input | Adapter bagian 14 | Tim pengembang |
| 9 | Siapa yang boleh mengunggah PDF | Peserta (miliknya), coach, admin | Pihak yang meminta |
| 10 | Retensi data dan file PDF, retensi data setelah kontrak berakhir | Belum ditetapkan | Mitra dan hukum |
| 11 | Kuota Konselor AI | 30 pesan per bulan (placeholder) | Pihak yang meminta |
| 12 | ITP resmi dan sertifikat | Opsional, Fase 9 | Pihak yang meminta |
| 13 | Aturan batas booking dan batal | 12 jam dan 24 jam | Pihak yang meminta |
| 14 | Kebijakan permintaan reschedule oleh peserta | Peserta memilih slot coach lain yang tersedia; permintaan waktu bebas tidak mengubah jadwal otomatis | Pihak yang meminta |
| 14 | Penulis materi HTML | Hanya `admin` pusat; materi dijalankan dalam iframe sandbox terisolasi | Tim keamanan/pengembang |

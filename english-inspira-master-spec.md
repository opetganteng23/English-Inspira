# Edulyfe EPTA (English Proficiency Test & Analytics) — Master Technical Specification & Build Instructions

Versi 1.1 · Basis: desain "English Inspira — Redesign Website" (28 layar, 3 peran). Nama produk resmi: **Edulyfe EPTA**. Teks "English Inspira" di desain adalah nama lama dan harus diganti saat implementasi UI.

## 0. Perubahan v1.1 (hasil audit desain terhadap spec)

**Keputusan yang dipakai sebagai default (ubah bila bisnis memutuskan lain)**

| Topik | Keputusan v1.1 | Alasan |
| --- | --- | --- |
| Login | **Email OTP saja.** Kolom kata sandi, tombol Google, dan OTP via WhatsApp di desain dihapus | Satu alur, tanpa penyimpanan kata sandi |
| Proctoring | **Ringan, tanpa rekaman kamera/mikrofon** (tab, fullscreen, paste, multi-tab). Kamera/mikrofon di layar 16 dan 19 dihapus. Bisa diaktifkan di versi berikutnya | Rekaman video membebani storage dan kepatuhan UU PDP |
| Kuota Konselor AI | **Berbasis jumlah pesan + masa berlaku**, mis. free trial 3 pesan, Tes Simulasi 30 hari dengan batas pesan per hari, Journey tanpa batas selama 6 bulan. Angka pasti ditentukan bisnis | Desain memakai masa berlaku, spec lama memakai jumlah pesan, jadi keduanya dipakai |
| Notifikasi | **Email saja.** Teks "WhatsApp" di desain diganti email. WhatsApp = fase lanjutan | Belum ada integrasi WhatsApp |
| Peran | Tetap 3 peran. Label "Super admin" = `admin` | Hindari peran baru tanpa kebutuhan jelas |
| Jenis tes | `kind` ditambah `prediction` (TOEFL Prediction, layar 16) | Desain memakai Diagnostic 1–4 dan Prediction 1–2 |

**Layar tambahan yang wajib didesain sebelum atau bersamaan dengan fasenya**

| Prioritas | Layar | Fase |
| --- | --- | --- |
| Tinggi | Admin: editor Materi (tab Rich Text, tab HTML, pratinjau, preset) | 5 |
| Tinggi | Admin: upload audio MP3 di editor Bank Soal dan editor Materi | 2 |
| Tinggi | Ruang tes: state Listening (pemutar sekali putar, progres, muat ulang audio) | 2 |
| Tinggi | Peserta: daftar Materi dan halaman belajar | 5 |
| Tinggi | Versi mobile (≤ 480 px) untuk layar peserta | 1–6 |
| Sedang | Ruang tes simulasi penuh, konfirmasi submit/waktu habis, pembahasan soal | 2 |
| Sedang | Admin: Voucher, Review Proctoring, Pengguna & Hak Akses, Pengaturan, Lead Free Trial, Institusi | 4–7 |
| Sedang | Portal institusi: Peserta, Kode & undangan, Jadwal rombongan, Laporan, Tagihan | 7 |
| Sedang | Halaman publik verifikasi sertifikat (tujuan QR) | 6 |
| Rendah | Lupa akses, Bantuan, Syarat & Ketentuan, Kebijakan Privasi/Refund, 403/404 | 1–8 |
| Rendah | Layout PDF: invoice, sertifikat, laporan hasil | 4, 6 |
| Rendah | State kosong, memuat, dan gagal (pembayaran gagal/kedaluwarsa, audio gagal, koneksi putus saat tes) | semua |

**Tambahan teknis**: field profil di `users`, jenis tes `prediction`, endpoint ekspor/impor, hapus akun (UU PDP), tautan bagikan hasil. Lihat bagian 5 dan 12. Undangan massal institusi tidak boleh lewat Gmail (batas ±500/hari): sediakan SMTP transaksional terpisah (mis. Brevo atau SES) yang dipilih lewat `MAIL_*`.

## 1. Ringkasan Produk

Platform persiapan TOEFL ITP: tes simulasi format ITP, analisis AI per section, Konselor AI, pendaftaran ITP resmi, sertifikat, dan dashboard institusi. Alur: **Tes → Hasil + analisis AI → Konselor AI → Tes ulang → Daftar ITP resmi**.

**Keputusan teknis yang sudah ditetapkan**

| Area | Keputusan |
| --- | --- |
| Database | MongoDB (Atlas atau self-hosted), ODM Mongoose |
| Email | Nodemailer + SMTP Gmail memakai **App Password** |
| Gambar/aset | Dikonversi ke **base64** di sisi klien, disimpan di MongoDB |
| Materi | Rich Text Editor lengkap **atau** HTML halaman penuh (bukan embed eksternal), JS dan CSS harus jalan dan interaktif |
| Pembayaran | Midtrans Snap |
| AI | Claude API (Konselor AI dan analisis hasil) |

## 2. Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind. Font Montserrat dan Poppins (sesuai desain).
- **Backend**: Next.js Route Handlers (satu repo) atau Express terpisah. Spec ini memakai Next.js fullstack.
- **Auth**: OTP email (6 digit, kedaluwarsa 5 menit) lalu sesi JWT di cookie `httpOnly`.
- **Editor materi**: TipTap (rich text) + mode "HTML Halaman" (CodeMirror).
- **Validasi**: Zod. **Rate limit**: `rate-limiter-flexible`. **Job/reminder**: `node-cron` atau BullMQ + Redis (opsional).

## 3. Peran & Hak Akses (RBAC)

| Peran | Cakupan |
| --- | --- |
| `participant` | Beranda, Journey, Tes, Hasil, Konselor AI, ITP resmi, Sertifikat, Belanja, Profil |
| `admin` | Semua modul admin: ringkasan, transaksi, paket/harga, voucher, peserta, bank soal, materi, review Konselor AI, proctoring, jadwal ITP dan input skor, pengguna/hak akses |
| `inst_admin` | Hanya data peserta yang `institutionId`-nya sama. **Filter wajib di level query**, bukan hanya di UI |

Middleware: `requireRole([...])` dan `scopeByInstitution(user)` dipanggil di setiap handler.

## 4. Peta Fitur ke Layar

| Layar | Modul |
| --- | --- |
| 01–03 | Landing, Masuk OTP, Daftar |
| 04–05 | Free trial (42 soal, ±37 menit) + hasil + 3 pertanyaan ke Konselor AI |
| 06–10 | Paket, Keranjang, Checkout, Midtrans, Riwayat |
| 11–19 | Beranda, Journey, Tes Saya, Hasil+AI, Konselor AI, Simulasi, ITP resmi, Sertifikat, Profil |
| 20–26 | Admin: ringkasan, transaksi, paket, peserta, bank soal, konselor AI, jadwal ITP |
| 27 | Admin institusi |

## 5. Model Data MongoDB

Semua koleksi: `_id`, `createdAt`, `updatedAt`. Index disebut di bawah.

**users** `{ email(unique), name, phone, role, institutionId?, nik?, birthDate?, gender?, status, targetScore?(450|500|550|600), goal?('kelulusan'|'beasiswa'|'pekerjaan'|'lainnya'), education?('sma'|'d3'|'s1'|'s2'), referralCode?, consentAt?, deletedAt? }` **otps** `{ email, codeHash, expiresAt(TTL), attempts }` — TTL index pada `expiresAt`. **institutions** `{ name, code(unique), seats, contactEmail }` **products** `{ slug, name, kind: 'single_sim'|'itp_only'|'journey'|'bundle', price, entitlements:[{type, ref, qty}], active }` **vouchers** `{ code(unique), type, value, maxUse, used, validUntil }` **orders** `{ userId, items:[{productId, price}], total, discount, status: 'pending'|'paid'|'failed'|'refunded', midtransOrderId(unique), snapToken, paidAt }` **entitlements** `{ userId, productId, source:'order'|'institution'|'manual', grants:[...], expiresAt }` — sumber kebenaran akses. Index `{userId, expiresAt}`. **questions** `{ section:'listening'|'structure'|'reading', type, passageId?, stem, options[], answerKey, explanation, tags[], assetIds[] , status }` **passages** `{ section, title, bodyHtml, assetIds[] }` **tests** `{ name, kind:'trial'|'diagnostic'|'prediction'|'sim', sections:[{name, durationSec, questionIds[]}] }` **attempts** `{ userId, testId, startedAt, finishedAt, answers:[{qid, choice, timeSpentSec}], scoreRaw, scoreEst, sectionScores, proctorFlags[], aiAnalysis }` **counselor_threads** `{ userId, attemptId?, messages:[{role, content, at}], actionPlan:[{text, done, dueAt}], reviewed }` **itp_sessions** `{ title, date, place, quota, registered, status }` **itp_registrations** `{ userId, sessionId, fullName, nik, birthDate, gender, idPhotoAssetId, facePhotoAssetId, status:'submitted'|'confirmed'|'done', score? }` **certificates** `{ userId, type:'itp'|'sim_report', number(unique), data, issuedAt }` **assets** `{ ownerId, mime, size, width, height, dataBase64, sha256(unique sparse) }` **audios** + GridFS bucket `audio` (lihat bagian 9A) **materials** (lihat bagian 8) **leads** `{ email, source, createdAt }` · **audit_logs** `{ actorId, action, target, meta, at }`

### Aturan sistem

- Akses fitur **selalu** dicek dari `entitlements`, bukan dari status order.
- Upgrade ke Journey: harga = harga paket − total pembelian satuan yang sudah dibayar (contoh desain: 1.490.000 − 734.000 = 756.000).
- Skor estimasi dihitung server-side dengan tabel konversi raw ke skala 310–677. Tabel konversi disimpan di konfigurasi, bukan hard-code.

## 6. Autentikasi & Mailer (App Password)

**Setup Gmail**: aktifkan 2-Step Verification, buat App Password di *Google Account → Security → App passwords*, lalu salin 16 karakter tanpa spasi.

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=noreply@domain-anda.com
MAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
MAIL_FROM="Edulyfe EPTA <noreply@domain-anda.com>"
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

**Alur OTP**: `POST /api/auth/request-otp` → generate 6 digit dengan `crypto.randomInt`, simpan **hash** (bcrypt/SHA-256+salt), kirim email → `POST /api/auth/verify-otp` → maksimal 5 percobaan, lalu terbitkan cookie sesi. **Rate limit**: 3 permintaan OTP per email per 10 menit dan 10 per IP per jam.

> Catatan: Gmail membatasi kirim ±500 email/hari (akun biasa). Cukup untuk OTP dan notifikasi tahap awal, tetapi tidak untuk undangan massal institusi. Bungkus pengiriman dalam `sendMail()` agar bisa ganti ke SMTP lain tanpa mengubah kode lain. Semua email dikirim lewat antrean dan tidak boleh memblokir request.

**Template email**: OTP, konfirmasi pembayaran, konfirmasi pendaftaran ITP, pengingat rencana aksi, undangan institusi.

## 7. Strategi Gambar Base64

**Tujuan**: tidak perlu storage file eksternal. **Risiko yang harus dikendalikan**: base64 membengkakkan ukuran ±33% dan dokumen MongoDB maksimum **16 MB**.

Aturan wajib:

1. **Kompres di klien** sebelum upload: `canvas` → resize maks 1280 px sisi terpanjang → WebP/JPEG kualitas 0.8. Target ≤ 300 KB per gambar. Foto KTP/pas foto ≤ 500 KB.
2. **Simpan di koleksi `assets` terpisah**, jangan di-embed di dokumen `questions`/`materials`/`users`. Dokumen lain hanya menyimpan `assetId`.
3. **Sajikan lewat endpoint** `GET /api/assets/:id` yang mengembalikan biner (decode base64) dengan `Cache-Control: public, max-age=31536000, immutable` dan `ETag = sha256`. Browser dan CDN meng-cache, sehingga DB tidak terbebani.
4. **Deduplikasi** dengan `sha256`.
5. **Whitelist MIME**: `image/jpeg|png|webp|gif`. SVG ditolak atau disanitasi (SVG dapat memuat script).
6. Aset sensitif (KTP) hanya dapat diakses pemilik dan admin. Endpoint-nya wajib auth, dan `Cache-Control: private, no-store`.
7. Proyeksi query: jangan pernah `find()` `assets` tanpa `.select('-dataBase64')` pada listing.

Di editor materi, gambar yang di-paste/drag otomatis diubah menjadi `assets`, lalu di HTML ditulis sebagai `<img src="/api/assets/ID">`. Dengan begitu isi materi tetap ringan.

## 8. Modul Materi (Rich Text atau HTML Halaman Penuh)

**materials** `{ title, slug, type:'rich'|'html', contentJson?, contentHtml?, htmlDoc?{html,css,js}, assetIds[], tags[], status:'draft'|'published', version, authorId }`

### 8.1 Mode Rich Text (TipTap)

Ekstensi: heading, bold/italic/underline/strike, warna & highlight, daftar, checklist, tabel, blockquote, code block, link, gambar (→ assets), YouTube/video, rata teks, subscript/superscript, undo/redo, penghitung kata. Simpan `contentJson` (sumber) dan `contentHtml` (hasil render, hasil sanitasi). **Sanitasi wajib** saat simpan dan saat tampil: DOMPurify (sisi klien) dan `sanitize-html` (sisi server). Whitelist tag dan atribut.

### 8.2 Mode HTML Halaman Penuh (interaktif)

Admin menulis atau menempel satu dokumen HTML utuh (HTML + `<style>` + `<script>`), berupa latihan interaktif, kuis, flashcard, simulasi, dsb. Dirender sebagai **satu halaman**, bukan embed situs luar.

**Cara render yang membuat JS dan CSS berjalan, tetapi aman:**

```html
<iframe
  sandbox="allow-scripts allow-forms allow-modals"
  srcdoc="{{dokumen HTML lengkap, di-escape}}"
  style="width:100%;border:0"
  referrerpolicy="no-referrer"></iframe>
```

- `srcdoc` membuat konten satu dokumen mandiri: CSS dan JS di dalamnya langsung bekerja, tanpa URL luar.
- `sandbox` **tanpa** `allow-same-origin`: script materi berjalan di origin buram sehingga **tidak bisa** membaca cookie, `localStorage`, atau memanggil API aplikasi sebagai pengguna. Ini wajib, karena materi berisi JS buatan admin (dan admin bisa saja akun yang disusupi).
- Terapkan CSP di dalam dokumen: injeksikan `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src data: blob: 'self'; font-src https://fonts.gstatic.com; connect-src 'none'">`.
- **Tinggi otomatis**: script kecil yang diinjeksi mengirim `postMessage({h: document.body.scrollHeight})`; halaman induk memvalidasi `event.source` lalu mengatur tinggi iframe. Jadi terlihat seperti satu halaman utuh tanpa scroll ganda.
- **Gambar** di HTML materi: `<img src="/api/assets/ID">` atau `data:` base64 langsung (batasi total dokumen ≤ 2 MB).
- **Isian interaktif** (input, select, textarea, drag-drop) bekerja normal. Untuk menyimpan jawaban/skor latihan, sediakan API jembatan: materi memanggil `parent.postMessage({type:'ei:progress', score, answers})`; induk memverifikasi lalu `POST /api/materials/:id/progress`. Materi tidak pernah menyentuh API secara langsung.
- **Editor admin**: tab Kode (HTML/CSS/JS terpisah, CodeMirror) + tab Pratinjau langsung (iframe sandbox yang sama) + tombol "Uji di layar ponsel".
- **Preset template**: kuis pilihan ganda, flashcard, isian kosong (fill-in-the-blank), drag-and-drop pencocokan, timer latihan. Admin non-teknis tinggal mengubah teks.
- Versioning: setiap publish menaikkan `version` dan menyimpan snapshot, agar bisa rollback.

## 9. Mesin Tes

- **Mulai tes**: server membuat `attempt` dan menetapkan `startedAt`. Timer **dipegang server**; klien hanya menampilkan.
- **Autosave** jawaban tiap perubahan (debounce 2 dtk) ke `PATCH /api/attempts/:id`. Tangguh terhadap refresh dan koneksi putus.
- **Listening**: audio mp3 dari GridFS, aturan putar sekali, lihat bagian 9A.
- **Submit** (atau waktu habis) → server menghitung skor raw → estimasi skor skala 310–677 → simpan per section → picu analisis AI (job async).
- **Proctoring ringan**: catat `visibilitychange`, keluar fullscreen, paste, dan multi-tab sebagai `proctorFlags`; admin meninjau di modul Review Proctoring.
- **Free trial**: 1 attempt per akun/email; hasil memberi 3 pertanyaan ke Konselor AI.

## 9A. Audio Listening (Upload MP3 oleh Pembuat Soal/Materi)

Admin dan kontributor soal dapat mengunggah audio langsung dari editor Bank Soal dan editor Materi.

**Penyimpanan**: audio **tidak** di-base64 (terlalu besar untuk batas 16 MB per dokumen). Disimpan di **MongoDB GridFS** (bucket `audio`), sedangkan metadata ada di koleksi `audios`.

**audios** `{ gridFsId, title, mime, size, durationSec, sha256, transcript, uploaderId, status }` **questions / passages** menyimpan `audioId?`. Satu audio dapat dipakai banyak soal (satu percakapan → beberapa soal), sehingga dibuat **question group**: `{ audioId, instruction, questionIds[] }`.

**Alur upload (admin)**

1. Pilih file di editor (drag-and-drop atau tombol) → klien memeriksa tipe dan ukuran.
2. Unggah ke `POST /api/audio` (multipart, streaming ke GridFS, tidak dimuat penuh ke memori).
3. Server memvalidasi: ekstensi `.mp3` (opsional `.m4a`, `.wav`), MIME `audio/mpeg`, **magic bytes** (header `ID3` atau frame sync `0xFFEx`), ukuran maks **15 MB**, durasi maks 10 menit (dibaca dengan `music-metadata`).
4. Server menghitung `sha256` (deduplikasi), menyimpan `durationSec`, lalu mengembalikan `audioId`.
5. Editor menampilkan pemutar pratinjau, kolom **transkrip** (hanya terlihat admin, dan ditampilkan ke peserta setelah tes selesai sebagai pembahasan), dan tombol ganti/hapus.
6. Audio yang masih dipakai soal tidak dapat dihapus (cek referensi).

**Pemutaran ke peserta**

- Endpoint `GET /api/audio/:id` mendukung **HTTP Range** (seek dan streaming), `Content-Type: audio/mpeg`, `Accept-Ranges: bytes`.
- Akses butuh sesi dan `attempt` aktif milik peserta, atau **signed URL** berumur pendek (token JWT 10 menit, di query string).
- **Mode tes (ala ITP resmi)**: audio diputar **sekali**, tanpa pause atau ulang. Server mencatat `playedAt` per `attempt` + `audioId`; permintaan kedua ditolak. Kontrol seek dinonaktifkan di pemutar. Progres tersimpan, sehingga refresh di tengah audio melanjutkan dari posisi terakhir yang dilaporkan, bukan mengulang dari awal.
- **Mode latihan/materi**: pemutar penuh (play, pause, ulang, kecepatan 0.75×–1.25×, tampilkan transkrip).
- Audio otomatis dimulai sesuai aturan section, dan timer section jalan bersama durasi audio.
- Unduh langsung tidak ditawarkan (`controlsList="nodownload"`, tanpa URL publik). Ini menyulitkan, **bukan** perlindungan mutlak: audio yang diputar di browser pada dasarnya tetap dapat direkam.

**Audio di dalam materi mode HTML (iframe sandbox)**: karena iframe tanpa `allow-same-origin`, cookie tidak ikut terkirim. Solusinya: tag `<audio src="/api/audio/ID?token=...">` memakai **signed URL** yang disisipkan server saat render, dan CSP iframe ditambah `media-src 'self'`. Di editor Rich Text, tombol "Sisipkan audio" membuat blok pemutar yang sama.

**Sisi klien tes**: preload audio berikutnya (`preload="auto"`) agar tidak ada jeda; deteksi buffering/gagal muat dan beri opsi "Muat ulang audio" (tidak dihitung sebagai pemutaran ulang jika belum ada byte yang diputar); uji perangkat audio sebelum tes dimulai di layar Persiapan Tes Simulasi.

## 10. AI: Analisis Hasil & Konselor

Server memanggil Claude API (kunci hanya di server, tidak pernah ke klien).

- **Analisis hasil**: input = skor per section, jawaban salah per `tags` tipe soal, waktu per soal, soal tak terjawab. Output JSON terstruktur `{summary, weaknesses[], gapToTarget, nextSteps[]}` (validasi dengan Zod, ulang jika tidak valid).
- **Konselor**: system prompt berisi profil, target skor, sisa waktu belajar, ringkasan semua attempt. Riwayat dipangkas ke N pesan terakhir + ringkasan.
- **Rencana aksi**: model mengeluarkan `actionPlan` (JSON) yang disimpan sebagai checklist; cron mengirim pengingat tiap Senin (email, dan WhatsApp bila nanti diintegrasikan).
- **Guardrail**: hanya topik persiapan ITP; tidak menjanjikan skor; saran jadwal ITP resmi minimal sesuai selisih skor dan waktu belajar; batasi kuota pesan per paket (free trial = 3).
- Admin: modul Review Konselor AI untuk menandai jawaban buruk (`reviewed`, `flag`).

## 11. Pembayaran Midtrans

1. `POST /api/checkout` membuat `order(pending)` lalu memanggil Snap API → `snapToken`.
2. Klien membuka Snap popup.
3. `POST /api/midtrans/notification` (webhook): **verifikasi `signature_key`** (SHA512 `order_id+status_code+gross_amount+ServerKey`), idempoten, lalu ubah status order dan buat `entitlements`, kirim email konfirmasi.
4. Admin: refund dan "buka akses manual" tercatat di `audit_logs`. Jangan pernah mempercayai status dari klien.

## 12. Daftar API Utama

```
Auth      POST /api/auth/request-otp · verify-otp · logout · GET /api/me
Katalog   GET /api/products · POST /api/cart/validate · POST /api/vouchers/apply
Order     POST /api/checkout · GET /api/orders · POST /api/midtrans/notification
Tes       GET /api/tests · POST /api/tests/:id/start · PATCH /api/attempts/:id · POST /api/attempts/:id/submit · GET /api/attempts/:id/result
AI        POST /api/counselor/threads/:id/messages · PATCH /api/counselor/plan/:itemId
ITP       GET /api/itp/sessions · POST /api/itp/registrations · GET /api/certificates
Materi    GET /api/materials · GET /api/materials/:slug · POST /api/materials/:id/progress
Aset      POST /api/assets · GET /api/assets/:id
Audio     POST /api/audio · GET /api/audio/:id (Range) · PATCH /api/audio/:id (judul, transkrip) · DELETE /api/audio/:id
Admin     /api/admin/{dashboard,orders,products,vouchers,users,questions,materials,counselor-review,proctoring,itp-sessions,scores,certificates}
Institusi /api/inst/{summary,participants,invites,reports,invoices}
Akun      PATCH /api/me (profil) · POST /api/me/email-change (OTP ke email baru) · GET /api/me/export (unduh data) · DELETE /api/me (hapus akun, anonimisasi)
Berbagi   POST /api/attempts/:id/share (tautan publik read-only, bisa dicabut) · GET /api/share/:token
Verifikasi GET /api/certificates/verify/:number (publik, tanpa data sensitif)
Ekspor    GET /api/admin/{orders,users,scores}/export.xlsx · POST /api/admin/questions/import (xlsx) · POST /api/admin/scores/import (xlsx)
Invoice   GET /api/orders/:id/invoice.pdf
```

## 13. Keamanan (ringkas)

- Cookie `httpOnly; Secure; SameSite=Lax`, proteksi CSRF untuk mutasi.
- Zod pada semua input, `mongo-sanitize` (cegah NoSQL injection), `helmet` / security headers.
- Sanitasi HTML materi, sandbox iframe tanpa same-origin (bagian 8).
- Data KTP/NIK: akses dibatasi, dicatat di `audit_logs`; pertimbangkan enkripsi field (AES-256-GCM) untuk `nik`. Patuhi UU PDP (persetujuan, retensi, hak hapus).
- Secret hanya di environment, dan jangan di-commit.
- Backup MongoDB terjadwal (Atlas snapshot atau `mongodump` harian).

## 14. Struktur Proyek

```
english-inspira/
├─ app/
│  ├─ (public)/ page.tsx, masuk, daftar, trial
│  ├─ (participant)/ beranda, journey, tes, hasil, konselor, itp, sertifikat, profil, paket, keranjang, checkout, riwayat
│  ├─ (admin)/admin/…      (inst)/institusi/…
│  └─ api/…                 (route handlers sesuai bagian 12)
├─ lib/ db.ts, auth.ts, mailer.ts, rbac.ts, scoring.ts, ai.ts, midtrans.ts, sanitize.ts
├─ models/ (Mongoose schema per koleksi)
├─ components/ editor/, test-room/, material-frame/, ui/
├─ jobs/ reminders.ts, ai-analysis.ts
├─ scripts/ seed.ts
├─ .env.example · Dockerfile · docker-compose.yml
```

## 15. Build Instructions (langkah demi langkah)

**Prasyarat**: Node 20+, akun MongoDB Atlas (atau Docker), akun Gmail dengan App Password, akun Midtrans Sandbox, API key Anthropic.

```bash
# 1. Inisialisasi
npx create-next-app@latest english-inspira --ts --tailwind --app
cd english-inspira
npm i mongoose zod jose bcryptjs nodemailer midtrans-client @anthropic-ai/sdk \
  music-metadata busboy sanitize-html isomorphic-dompurify rate-limiter-flexible node-cron express-mongo-sanitize \
  @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-table \
  @tiptap/extension-link @tiptap/extension-underline @tiptap/extension-text-align \
  @tiptap/extension-highlight @tiptap/extension-color @tiptap/extension-text-style \
  @uiw/react-codemirror @codemirror/lang-html

# 2. Environment (.env.local)
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<random 64 char>
APP_URL=http://localhost:3000
MAIL_* (lihat bagian 6)
MIDTRANS_SERVER_KEY=... MIDTRANS_CLIENT_KEY=... MIDTRANS_IS_PRODUCTION=false
ANTHROPIC_API_KEY=...
FIELD_ENCRYPTION_KEY=<32 byte base64>

# 3. Jalankan lokal
npm run dev
npm run seed    # produk, tes trial, soal contoh, akun admin
```

**Urutan pengerjaan (fase)**

| Fase | Isi | Hasil yang bisa diuji |
| --- | --- | --- |
| 1 | Fondasi: koneksi DB, model, RBAC, mailer, OTP, layout peserta/admin | Login OTP masuk ke email |
| 2 | Bank soal, asset base64, mesin tes, skor, free trial | Trial 42 soal sampai hasil |
| 3 | AI: analisis hasil + Konselor + rencana aksi | Chat dan checklist tersimpan |
| 4 | Produk, keranjang, voucher, Midtrans, entitlements, Journey/upgrade | Bayar sandbox membuka akses |
| 5 | Modul Materi: TipTap, mode HTML sandbox, progress | Materi HTML interaktif jalan |
| 6 | ITP resmi: jadwal, pendaftaran, input skor, sertifikat (PDF) | Daftar sampai sertifikat |
| 7 | Admin lengkap + dashboard institusi + laporan PDF/Excel | Semua peran |
| 8 | Hardening, uji beban, backup, deploy | Siap produksi |

**Deploy**: Vercel atau VPS (Docker + Nginx + HTTPS). Set semua env, daftarkan URL webhook Midtrans, pastikan cron berjalan (VPS: proses terpisah; Vercel: Vercel Cron).

## 16. Kriteria Penerimaan (contoh)

- OTP salah 5× → terkunci; OTP kedaluwarsa ditolak.
- Refresh saat tes tidak mengubah sisa waktu dan tidak menghilangkan jawaban.
- Webhook ganda tidak membuat `entitlement` ganda.
- `inst_admin` tidak pernah dapat membaca peserta institusi lain (uji otomatis).
- Materi HTML: tombol, input, dan animasi CSS berfungsi; script materi **tidak** dapat membaca cookie atau memanggil `/api/*`.
- Upload mp3 valid tersimpan di GridFS; file non-mp3 yang diganti ekstensinya ditolak (cek magic bytes).
- Audio listening di mode tes hanya bisa diputar sekali per attempt; permintaan kedua ditolak server.
- Gambar > 300 KB otomatis terkompres sebelum tersimpan; listing aset tidak memuat `dataBase64`.

## 17. Hal yang Perlu Diputuskan Bisnis

Placeholder yang masih kosong di desain: `[HARGA]`, `[NAMA MITRA RESMI ETS]`, `[X] hari` retensi, `[KEBIJAKAN RESCHEDULE]`, `[NAMA INSTITUSI]`. Keputusan v1.1 di bagian 0 (proctoring, kuota Konselor, notifikasi) juga perlu konfirmasi bisnis.

Nama mitra resmi ETS, kebijakan reschedule/refund ITP, tabel konversi skor resmi, kuota pesan Konselor AI per paket, retensi data KTP, dan harga final tiap produk.
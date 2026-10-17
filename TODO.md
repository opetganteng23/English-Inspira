# TODO English Inspira (repo Edulyfe EPTA) — acuan: English_Inspira_LMS_MTS_V2_8.md (v2.8)

Legenda status: ✅ Sudah · 🔄 Sedang · ⬜ Belum · ⏭️ Sengaja dilewati/ditunda (alasan wajib) · ❌ Dihapus karena bertentangan dengan v2.2
Prioritas: **P1** fondasi (Fase 1+3) → **P2** belajar & analitik (Fase 4+5) → **P3** coaching (Fase 6) → **P4** PDF/level-up/laporan/hardening (Fase 7+8) → **P5** opsional (Fase 9, sudah ada)

Aturan: setiap perubahan dicatat di sini. Status "✅" hanya bila sudah dijalankan/diuji, bukan sekadar ditulis.

## 0. Keputusan yang dikonfirmasi pemilik

| # | Keputusan | Status |
|---|---|---|
| K1 | **MTS v2.2 adalah acuan resmi.** Model v1 (jual paket, Midtrans, voucher, free trial, daftar publik) dibuang | ✅ dikonfirmasi. Perubahan 2026-10-09 atas permintaan pemilik: daftar mandiri **wajib kode institusi** + login password (lihat §14) |
| K2 | Soal Listening boleh membawa audio (via grup soal; MP3 di GridFS) | ✅ sudah didukung; unggah audio langsung di editor soal = T-AUD |
| K3 | Deploy: Biznet Gio Cloud + PM2 (satu instance) + Nginx | ✅ dokumen siap (README, `ecosystem.config.cjs`, `deploy/`) |
| K4 | Bentuk **pure-analytics** (library/service) | ⬜ menunggu modul/kontrak. Sementara: perhitungan angka di kode sendiri (adapter §14) |
| K5 | Angka level, tabel konversi skor resmi, retensi data, kuota Konselor | ⬜ placeholder dari MTS §5; admin dapat mengubah lewat Parameter Sistem |
| K6 | Nama produk di UI: **English Inspira** (sesuai MTS, desain, dan logo Inspira dari pemilik). Domain/DB/PM2 tetap `edulyfe` | ✅ |

## 1. Pembuangan model v1 (❌ → hapus) — P1

| ID | Item | Status |
|---|---|---|
| R1 | Koleksi `products`, `vouchers`, `orders`, `entitlements`, `leads` + seed produk | ✅ model & rute dihapus |
| R2 | Midtrans, webhook, `/api/checkout`, `/api/cart`, `/api/orders`, invoice PDF, mode simulasi bayar | ✅ rute, Midtrans, invoice PDF dihapus |
| R3 | Free trial (diganti placement), pendaftaran publik `/daftar`, landing publik, kode institusi self-join | ✅ `/daftar` 404 (teruji), self-join dihapus. `/` kini landing publik (tanpa harga/daftar/free trial; CTA Sign in + kontak institusi) |
| R4 | Halaman Paket, Keranjang, Checkout, Pembayaran, Riwayat; admin Transaksi, Paket, Voucher, Lead; Journey v1 | ✅ halaman dihapus; menu baru |
| R5 | Tagihan institusi (`InstInvoice`) — tidak ada di v2.2 | ✅ |

## 2. Fondasi — Fase 1 (P1)

| ID | Item (MTS §) | Status |
|---|---|---|
| F1 | OTP, rate limit, sesi JWT httpOnly, CSRF, header keamanan (§7, §20) | ✅ |
| F2 | OTP **hanya untuk email terdaftar** (invited/active + enrollment berlaku), respons selalu sama (§7) | ✅ teruji (smoke) |
| F3 | Role `coach`; `institutionId` wajib untuk participant/coach/inst_admin (§4) | ✅ teruji (coach wajib institusi) |
| F4 | `enrollments` sebagai sumber kebenaran akses; kedaluwarsa saat kontrak berakhir (§6, §8) | ✅ teruji (kontrak lewat/diperpanjang) |
| F5 | `institutions`: contractStart/End, status, seats, configOverrides (§6) | ✅ |
| F6 | `invitations` (token berumur 7 hari) + email undangan (§8) | ✅ teruji (token sekali pakai) |
| F7 | Impor CSV/Excel peserta: validasi, duplikat, tolak > seats, laporan baris gagal (§8) | ✅ CSV teruji; Excel (.xlsx) kode ada, belum diuji |
| F8 | Status invited → active setelah login pertama + persetujuan data UU PDP (§8) | ✅ teruji |
| F9 | `mail_queue` + worker (retry bertahap, undangan ±100/jam), template email lengkap (§7, §18) | 🔄 antrean + retry + template ✅; batas undangan/jam & SMTP nyata belum diuji |
| F10 | `mongo-sanitize` pada input (§20) | ✅ `mongoSanitize` pada data bebas bentuk (Mixed: jawaban materi, contentJson); input lain lewat Zod; query string selalu string — diuji unit |
| F11 | Koleksi `notifications` + notifikasi dalam aplikasi (§6, §18) | ✅ notifikasi dalam aplikasi: lonceng di semua layout + API baca/tandai; terisi dari placement, naik level, analisis siap, booking, slot berubah/batal, pengingat sesi, deadline rencana, kuota, kontrak (teruji smoke; tampilan belum dicoba di browser) |
| F12 | Audit log akses coach & inst_admin ke data peserta (§20) | ✅ audit akses admin, coach, dan inst_admin ke data individu (lihat peserta, laporan, percakapan, PDF) |

## 3. Konfigurasi, tes, placement — Fase 2+3 (P1)

| ID | Item (MTS §) | Status |
|---|---|---|
| C1 | `levels` + `config_params` di database, halaman **Parameter Sistem** admin (§5) | ✅ API teruji; halaman `/admin/parameter` dibangun (belum dicoba di browser) |
| C2 | `score_conversion` dibaca dari config (bukan file JSON); peringatan "wajib diverifikasi" (§5) | ✅ dari config (mode tabel diuji unit); label "placeholder" di UI |
| C3 | Tag soal **dua tingkat** `{skill, topic}` wajib di Bank Soal (§6) | ✅ API teruji (published wajib tag); UI tag dibangun (belum dicoba di browser) |
| C4 | `tests.kind`: placement / sim / practice / quiz + `levelId` (§6) | ✅ (UI perakit: kind + level) |
| C5 | `attempts`: `firstChoice`, `changes`, waktu idle dikurangi, `topicScores` (§11) | ✅ `firstChoice` & `changes` dihitung server (teruji); waktu per soal hanya waktu aktif (tab terlihat + interaksi dalam `idle_timeout_sec`, atau audio sedang diputar) — logika klien belum dicoba di browser |
| C6 | Placement test sekali (ulang hanya izin admin/coach) → level otomatis → `coaching_quotas` 8/4/2 → email hasil (§12) | ✅ teruji end-to-end (level, kuota, ulang atas izin) |
| C7 | Mesin tes: timer server, autosave, proctoring ringan, audio GridFS/Range/sekali putar | ✅ (teruji; timer habis belum) |
| C8 | Transkrip audio tampil setelah tes; pemutar penuh 0.75–1.25× di mode latihan (§11) | ✅ transkrip setelah tes; mode latihan: pemutar penuh 0.75–1.25× dan boleh diulang (server tidak mengunci audio untuk `practice`) — UI/pemutar belum dicoba di browser, uji API audio butuh berkas MP3 |
| C9 | Bank Soal, perakit Tes, impor Excel soal | ✅ Bank Soal, perakit Tes, impor soal CSV/Excel (cek dulu, laporan per baris, templat) — teruji |
| T-AUD | Unggah/pilih **audio langsung di editor soal Listening** (membuat grup otomatis) | 🔄 dibangun di editor soal (pilih/unggah → grup otomatis); API grup teruji, UI belum dicoba di browser |

## 4. Belajar & materi — Fase 4 (P2)

| ID | Item (MTS §) | Status |
|---|---|---|
| L1 | Level → Course → Unit; `unit_progress`; syarat lulus (`unit_pass_score`, kuis dari bank soal) (§10.1) | ✅ Level → Course → Unit, `unit_progress`, lulus = materi wajib selesai + kuis ≥ `unit_pass_score` (teruji smoke: kuis gagal → lulus → unit selesai) |
| L2 | Admin: kelola course/unit/`requiredItems`; peserta hanya melihat course sesuai level | ✅ admin: halaman Kursus & Unit (course/unit/materi wajib/kuis); peserta hanya melihat course levelnya — UI belum dicoba di browser |
| L3 | Rich text (TipTap) — fitur dasar, gambar→assets, YouTube, audio | ✅ (belum diuji di browser) |
| L4 | Rich text lengkap: ukuran/jenis font, audio dengan transkrip, lampiran PDF, layar penuh, pratinjau ponsel, DOMPurify klien (§10.2) | ✅ font (jenis/ukuran), warna, highlight, rata, sub/superskrip, daftar, checklist, tabel (tambah/hapus/gabung/pisah sel), kutipan, kode, garis, tautan, gambar→assets, YouTube, audio + transkrip, lampiran PDF, penghitung kata, layar penuh, pratinjau ponsel, DOMPurify klien + sanitize-html server — sanitizer diuji unit/smoke; **editor belum dicoba di browser** |
| L5 | Blok interaktif bawaan di rich text (kuis/flashcard/isian/pencocokan/timer) bertag topik → `learning_events` | ✅ blok kuis, flashcard, isian, pencocokan, timer, catatan/tips; konfigurasi JSON divalidasi server; tiap butir wajib bertopik dan mengirim hasil ke `topic_stats` (sekali per butir per hari) — API teruji; komponen & dialog belum dicoba di browser; ubah blok = hapus lalu buat ulang |
| L6 | Penulis rich text: admin, coach, inst_admin (sekarang admin saja) | ✅ coach & inst_admin menulis rich text untuk institusinya (materi ber-`institutionId`, hanya terlihat peserta institusi itu); HTML tetap hanya admin — teruji |
| L7 | HTML sandbox: **hanya** `allow-scripts allow-forms`; CSP baseline ketat tanpa host eksternal (§10.3) | ✅ sandbox hanya `allow-scripts allow-forms`; CSP baseline tanpa host eksternal (diuji unit); isolasi di browser nyata belum diuji |
| L8 | Jembatan: pesan ber-versi + **nonce** + tipe `report`/`complete` + Zod + batas frekuensi; hapus global `EI` umum (§10.3) | ✅ pesan ber-versi + nonce (jembatan menghapus dirinya dari DOM) + Zod + batas frekuensi; `EI` dibekukan; `report`/`complete` (diuji unit) |
| L9 | Status materi draft → **review** → published, audit penulis/reviewer/publish/rollback (§10.3) | ✅ draft → review → published, HTML wajib review, penerbit ≠ penyunting bila >1 admin, ubah isi HTML terbit → draf; audit tiap langkah (teruji smoke) |
| L10 | Uji keamanan iframe: akses parent/storage/cookie, jaringan, navigasi, popup, pesan palsu, nonce salah, iframe lama (§20, §24) | 🔄 validasi pesan/nonce/CSP diuji unit; pengujian di browser (akses parent/storage/cookie, jaringan, navigasi, popup) ⬜ |
| L11 | `learning_events` + heartbeat `POST /api/events` (waktu aktif saja, `idle_timeout_sec`) (§13.1) | ✅ `learning_events` + `POST /api/events` (maks 30 dtk/detak, batas frekuensi, hanya peserta); klien mengirim hanya saat tab terlihat & aktif dalam `idle_timeout_sec` — hook klien belum diuji di browser |

## 5. Analitik & study plan — Fase 5 (P2)

| ID | Item (MTS §) | Status |
|---|---|---|
| A1 | `topic_stats` akumulatif (α=0.3), status strong/ok/weak/priority/insufficient, minimum 5 butir (§13.2) | ✅ `topic_stats` akumulatif (α dari config), 5 status, min 5 butir — diuji unit + smoke |
| A2 | Deteksi stuck (>2× median, min 20 sampel; 3 salah beruntun) (§13.2) | ✅ stuck: >N× median (min sampel) atau N salah beruntun — diuji unit; median lintas peserta belum diuji dengan data nyata |
| A3 | Koleksi `analyses` (calculated → ready) dibuat **setiap** selesai: placement, kuis, unit, sim, remedial, PDF (§13.3) | ✅ `analyses` dibuat tiap pengerjaan selesai (placement, sim, practice, kuis unit): `calculated` langsung tampil → `ready`/`failed`; remedial/PDF menyusul bersama fiturnya |
| A4 | Claude: input tanpa PII + alias, output Zod, retry 2×, validasi topik & angka narasi, cache hash input, catat model/versi prompt/token, prompt berversi di config (§13.5) | 🔄 output Zod berbentuk §13.5, topik wajib dari daftar valid, angka dicek terhadap input, retry 2×, cache hash input, catat engine/model/versi prompt/token, batas laju per peserta & institusi, prompt berversi di Parameter Sistem — logika murni teruji unit; **panggilan Claude nyata belum diuji (menunggu kunci API)** |
| A5 | Template narasi cadangan dikelola admin (§13.4) | ✅ template narasi cadangan dikelola admin (Parameter Sistem `narrative_template`); API gagal → template + ulang tiap jam (maks 3×); status gagal & pemakaian token tampil di dashboard admin |
| A6 | `remedial_map` + admin | ✅ `remedial_map` (topik → unit) + halaman di Kursus & Unit; item rencana otomatis tertaut ke unit level peserta (API teruji; tautan di Beranda belum dicoba di browser) |
| A7 | `study_plans`: item berdeadline otomatis (7/14 hari), maks 5 aktif, `source` auto/coach, tidak menimpa item coach (§15) | ✅ `plan_items` otomatis (deadline 7/14 hari, maks 5 aktif, resolved bila membaik, `late` bila lewat deadline, pengingat H-2) + item coach; teruji |
| A8 | Adapter `lmsAdapter` / `pdfAdapter` (§14); integrasi pure-analytics bila modul tersedia (K4) | ✅ adapter: `buildEngineInput` (pintu 1/lms) dan `buildPdfEngineInput` (pintu 2/pdf) menghasilkan format masukan yang sama; pure-analytics eksternal menunggu keputusan K4 |

## 6. Coaching — Fase 6 (P3)

| ID | Item (MTS §) | Status |
|---|---|---|
| H1 | `classes`, `coach_slots`, `bookings`, `attendance`, `coaching_quotas`, `session_notes` (§6) | ✅ `coach_slots` (kapasitas >1 = kelas kecil), `bookings`, `session_notes`, `coaching_quotas`; kehadiran tersimpan di booking. Entitas `classes` terpisah tidak dibuat (diganti kapasitas slot) |
| H2 | Coach membuat/menerbitkan/mengubah/membatalkan slot; cek bentrok; hanya coach pemilik/admin (§16.1) | ✅ coach buat/terbit/ubah/batal slot, bentrok ditolak, hanya pemilik/admin (teruji smoke) |
| H3 | Peserta memilih slot published sesuai institusi + level; booking **atomik**; batas 12 jam/24 jam (§16.2) | ✅ peserta memesan slot se-institusi & level; booking atomik (kapasitas bersyarat); daftar ≥12 jam, batal mandiri ≥24 jam (teruji) |
| H4 | Kehadiran & kuota idempoten sesuai tabel §16.3 | ✅ kehadiran → kuota menurut `quota_rules`, idempoten walau diklik paralel, koreksi mengembalikan kuota (teruji); batal oleh coach tidak memotong kuota |
| H5 | Laporan pra-sesi, catatan sesi, ubah study plan, rekomendasi naik level (§16.4) | ✅ laporan pra-sesi, catatan privat/dibagikan, item rencana coach, izin ulang placement oleh coach, rekomendasi naik level (tersimpan; aturan naik level otomatis = P3) |
| H6 | Dashboard coach (peserta, slot, sesi, catatan) | ✅ dashboard coach: Peserta saya (+laporan), Sesi & kehadiran, Jadwal slot — UI belum dicoba di browser |
| H7 | Notifikasi & email: booking, perubahan/pembatalan slot, pengingat H-1 | ✅ email: booking, slot berubah, slot batal, pengingat H-1 (job per jam, sekali per slot); notifikasi dalam aplikasi ⬜ |
| H8 | Pantauan admin: kuota tak mungkin habis sebelum kontrak, kehadiran coach, kepatuhan | ✅ halaman Pantauan Coaching: kuota vs kursi terbuka sebelum kontrak berakhir, kehadiran, peringatan |

## 7. PDF, Konselor, level-up, laporan, hardening — Fase 7+8 (P4)

| ID | Item (MTS §) | Status |
|---|---|---|
| P1 | Upload PDF (GridFS `pdf`, magic bytes, 10 MB), `pdf-parse`, layar verifikasi, analisis; file tidak dikirim ke AI (§14) | ✅ upload PDF (magic bytes, ≤10 MB, GridFS `pdf`), `pdf-parse` v2, parser template ITP, layar verifikasi/koreksi, analisis dari nilai terverifikasi saja (file tidak ke AI), akses pemilik/coach se-institusi/admin (audit), hapus oleh pemilik, retensi file via job harian — teruji smoke; halaman UI belum dicoba di browser; PDF hasil scan (OCR) ⬜ |
| P2 | Konselor AI: kuota **30 pesan/bulan** (`counselor_quota`), konteks dari `analyses` + study plan, tidak mengubah plan langsung, tinjauan admin **dan coach** (§17) | ✅ kuota 30/bulan, konteks dari `analyses` + study plan (AI hanya mengusulkan), tinjauan admin & coach (coach hanya institusinya, akses dicatat audit) — teruji; panggilan Claude nyata belum diuji |
| P3 | Aturan naik level otomatis + tahan/rekomendasi coach; kuota baru sesuai level, plan dibuat ulang (§12) | ✅ naik level otomatis (skor sim ≥ batas level berikutnya + remedial prioritas tinggi selesai; rekomendasi coach membebaskan syarat remedial), kuota baru, rencana dibuat ulang, email — teruji smoke + unit; status syarat tampil di Beranda & hasil |
| P4 | Dashboard admin & institusi v2.2 (level, kuota, kehadiran, kepatuhan, analisis gagal) | ✅ dashboard admin (peserta, level, tes, aksi, token AI, kontrak) dan institusi (placement, level, hasil, kehadiran, kuota, rencana terlambat, topik lemah, perlu perhatian) — API teruji; UI belum dicoba di browser |
| P5 | Portal institusi sesuai batas privasi §4 (tanpa isi analisis individu & catatan sesi) | ✅ portal institusi hanya agregat; tanpa analisis AI, percakapan, catatan coach (teruji); kode & tagihan dihapus |
| P6 | Laporan PDF + Excel (§8) | ✅ laporan Excel (+level, status) dan PDF kelompok; unduhan dicatat audit — teruji |
| P7 | Job: mail worker, reminder sesi, plan status, peringatan kuota, kontrak, pembersihan (§18) | ✅ job: mail (menit), per jam (pengingat sesi, ulang narasi AI), harian (kontrak, plan late, pengingat H-2, kuota, peringatan kontrak, PDF, pembersihan) — teruji lewat /api/cron; jalan di PM2 via node-cron belum diuji |
| P8 | Uji otomatis isolasi data **coach** & inst_admin (§20, §24) | ✅ inst_admin & coach teruji (smoke), termasuk coach institusi lain → 404 |
| P9 | Retensi data/PDF, hak hapus lewat prosedur admin + audit (§8, §25) | 🔄 hapus data lewat admin ✅ (kini termasuk PDF & analisis); retensi PDF otomatis ✅ (`pdf_retention_days`, placeholder 180 hari); retensi data lain ⬜ menunggu keputusan |
| P10 | Tampilan responsif terbukti di browser (Playwright, 9:16 & 16:9) | ⬜ belum dijalankan |

## 8. Opsional — Fase 9 (P5)

| ID | Item | Status |
|---|---|---|
| O1 | ITP resmi: jadwal, pendaftaran, input skor admin, sertifikat PDF + QR verifikasi | ✅ ITP resmi tanpa paket: sesi, daftar (NIK terenkripsi), verifikasi dokumen, skor, sertifikat PDF + verifikasi publik, ekspor roster — teruji ulang di smoke v2.2 |

## 9. Infrastruktur (selesai)

| Item | Status |
|---|---|
| Font lokal (build tidak bergantung Google), `next build` bersih | ✅ |
| README, PM2 (`ecosystem.config.cjs`), Nginx, `/api/health` | ✅ (deploy: Biznet Gio + PM2, **tanpa Docker**) |
| Uji unit (vitest, 60 uji) & `scripts/smoke.mjs` v2.2 (310 pemeriksaan API, semua lulus) | ✅ |
| `tsc --noEmit` & `next build` (termasuk lint) bersih | ✅ |

## 10. Temuan selama pengerjaan (arsip)

| Item | Status |
|---|---|
| Helper generik `model<T>()` Mongoose membuat `tsc` kehabisan memori | ✅ diganti pola inline |
| `next/font/google` gagal saat build tanpa cache/akses Google | ✅ font lokal |
| Hapus akun: nama masih tersisa di sertifikat/order | ✅ dianonimkan |
| Edit kunci soal saat attempt berjalan memengaruhi penilaian | ⬜ snapshot per attempt |
| Hanya `route.ts` yang boleh mengekspor handler HTTP (skema Zod ke `lib/`) | ✅ aturan dipatuhi |
| Respons `/api/itp/sessions` kehilangan `organizer`/`rescheduleDays`/`advice` (komentar `//` menelan sisa baris) | ✅ diperbaiki |
| Pemeriksaan smoke "OTP tidak dikirim ke peserta yang aksesnya berakhir" kondisinya lemah (membandingkan posisi log) | ✅ dihitung jumlah email OTP sebelum/sesudah |

## 11. Cakupan verifikasi (jujur)

| Area | Status |
|---|---|
| Semua API alur v2.2 (undangan, consent, placement→level→kuota, isolasi, kedaluwarsa, hak data) | ✅ teruji otomatis |
| Halaman UI baru/ditulis ulang (masuk, persetujuan, beranda, tes, hasil, profil, admin, institusi, coach) | 🔄 lolos build & lint, **belum dibuka di browser** |
| Responsif 9:16 s.d. 16:9 | ⬜ belum diuji (Playwright ditunda atas permintaan pemilik) |
| Timer server saat waktu habis, `pm2 start` di VM, email/AI/DB nyata | ⬜ menunggu kunci & URL DB |

## 12. Sisa pekerjaan

Keadaan terakhir: `tsc`, `next build` dan lint bersih; vitest 60/60; smoke 310/310 (alur v2.2 termasuk ITP, daftar, password, reset).

| Prioritas | Item | Status |
|---|---|---|
| P1 | Buka seluruh UI baru di browser + uji responsif 9:16 s.d. 16:9 (Playwright) | ⬜ (belum dijalankan; ditunda atas permintaan pemilik) |
| P2 | L10 uji keamanan iframe di browser (akses parent/storage/cookie, jaringan, navigasi, popup) | ⬜ |
| P3 | Uji panggilan Claude nyata, SMTP nyata, MongoDB nyata, node-cron di PM2 (menunggu kunci & URL DB) | ⬜ |
| P3 | OCR untuk PDF hasil scan | ⬜ |
| – | Keputusan pemilik: K4 pure-analytics, K5 angka resmi (level, konversi skor, retensi, kuota) | ⬜ |

## 13. Bahasa Inggris, font, landing, logo (permintaan pemilik 2026-10-09)

| ID | Item | Status |
|---|---|---|
| E1 | Bug "Kode salah": dua email OTP berjudul sama ditumpuk Gmail, pengguna membaca kode lama | ✅ kode kini ada di judul email (`123456 is your English Inspira sign-in code`) |
| E2 | Seluruh teks UI, API, email, PDF, prompt AI, preset materi dalam bahasa Inggris | ✅ sapuan kosakata + morfologi; sisa sengaja: nilai enum, alias kolom impor, URL rute, komentar kode, label uji smoke |
| E3 | Tanpa tanda panah (←→↑↓…) dan em dash di teks tampilan | ✅ diganti teks (Previous/Next/Up/Down…) dan "-" |
| E4 | Semua font Poppins (web, email, PDF, iframe materi) | ✅ PDF memakai TTF (WOFF2 membuat fontkit gagal: laporan PDF 500, kini diperbaiki) |
| E5 | Landing page bahasa Inggris mengikuti `English Inspira — Redesign Website.html` | ✅ hero, mitra, cara kerja, Konselor AI, journey 7 tahap, untuk institusi, untuk siapa, FAQ, CTA; tanpa harga/daftar/free trial; dicek di 1440 px dan 500 px |
| E6 | Logo Inspira (dari pemilik) di header, footer, favicon, PDF | ✅ `public/brand/logo-{white,navy}.png`, `app/icon.png` |
| E7 | Data contoh lama di Atlas (nama tes "(contoh)", pembahasan soal) | ✅ `scripts/migrate-en.ts` dijalankan di produksi (39 soal, 3 tes); nilai `goal` peserta ikut dikonversi |
| E8 | URL rute berbahasa Inggris (/home, /sign-in, /tests, /results, /admin/question-bank, /institution, …) | ✅ 37 rute dipindah; URL lama dialihkan permanen (308) termasuk query (tautan email lama tetap jalan) |
| E9 | Sapuan kedua: kosakata teks lama vs teks sekarang (±100 sisa: admin, coach, institusi, ITP, editor, pesan error) | ✅ |
| E10 | Nilai enum `goal` (kelulusan/beasiswa/…) jadi graduation/scholarship/career/other; label pendidikan & jenis kelamin dalam bahasa Inggris | ✅ |
| E11 | Favicon hanya logo (tanpa latar) | ✅ |
| E12 | Tombol "Back to home" di halaman masuk; logout kembali ke landing page | ✅ |
| E13 | Sengaja tidak diterjemahkan: komentar kode, label uji smoke, alias kolom impor berbahasa Indonesia (tetap diterima agar file Excel lama bisa diimpor), kode enum internal (`sma/d3/s1/s2`, `L/P`) | ⏭️ tidak tampil ke pengguna |

## 14. Akun: daftar, password, lupa password (permintaan pemilik 2026-10-09)

| ID | Item | Status |
|---|---|---|
| A1 | Login email + password; OTP email tetap sebagai pilihan kedua | ✅ teruji smoke |
| A2 | Daftar mandiri dengan **kode institusi**: verifikasi email 6 digit, kursi diambil saat verifikasi (spam tidak menghabiskan kursi) | ✅ teruji (kode salah, kursi penuh, belum verifikasi) |
| A3 | Email yang sudah punya akun: respons sama + email "akun sudah ada" (tidak membocorkan, password penyerang tidak berlaku) | ✅ teruji |
| A4 | Lupa password: tautan 30 menit, sekali pakai; reset juga membuktikan email | ✅ teruji |
| A5 | Ganti/set password di profil (password lama wajib bila sudah ada) | ✅ teruji |
| A6 | Kode institusi tampil di dasbor admin institusi dan daftar institusi admin | ✅ |
| A7 | Akun demo `davdchndra@gmail.com` (password diset, riwayat placement 473 lalu simulasi 497 dan 523, analisis, study plan, Konselor AI) | ✅ dibuat di produksi lewat `scripts/seed-demo-participant.ts` (email tidak dikirim) |
| A10 | Bug: jawaban JSON Claude sering rusak (tanda kutip) sehingga analisis jatuh ke template | ✅ analisis & Konselor AI memakai tool use (keluaran terstruktur), diuji ke API nyata |
| A8 | Hapus otomatis pendaftar yang tidak pernah memverifikasi email | ⬜ belum (tidak memakan kursi, hanya data) |
| A9 | Login password untuk coach/admin institusi/admin: memakai Lupa password untuk membuat password pertama (profil hanya untuk peserta) | ⏭️ cukup lewat Lupa password |

## 15. Mode pemeliharaan (permintaan pemilik 2026-10-09)

| ID | Item | Status |
|---|---|---|
| M1 | Saklar on/off + pesan di dasbor admin (`/admin`), tercatat di audit log | ✅ |
| M2 | Saat aktif: semua halaman non-admin menampilkan halaman pemeliharaan, API 503; admin tetap bisa semua; cron tetap jalan | ✅ teruji smoke |
| M3 | `/admin/login`: login khusus admin (password atau kode email), menolak akun bukan admin, tetap terbuka saat pemeliharaan | ✅ teruji |
| M4 | Status dibaca middleware dengan cache 10 detik di produksi (`INTERNAL_URL` untuk cek lewat localhost) | ✅ perubahan berlaku paling lambat 10 detik |
| M5 | Halaman error memuat ulang sekali bila chunk build lama hilang setelah deploy | ✅ |

## 16. MTS v2.4: kenyamanan belajar dan UI baru (2026-10-11)

Acuan: `English_Inspira_LMS_MTS_V2_4.md` bagian 27, mockup `design/ui-v2.4/ui/*.html`. Dikerjakan per tahap §27.11; tiap tahap di-commit dan di-deploy.

| Tahap | Isi | Status |
|---|---|---|
| 0 | Konten hanya admin: materi, lampiran, audio, soal, tes, course (coach & admin institusi dicabut; menu materi mereka dihapus) | ✅ teruji smoke (310/310) |
| 1 | Design token v2.4 (CSS variable + Tailwind), mode gelap, logo baru, Poppins 400/500/600, `uiPrefs` + `GET/PATCH /api/me/ui-prefs`, pengaturan tampilan di Profil, shell peserta menu atas | ⬜ |
| 2 | Halaman persiapan ("no pass or fail", struktur tes, 3 soal contoh tak dinilai) dan ruang tes (mode fokus, timer bisa disembunyikan, muncul di 5 dan 1 menit, tanda flag, navigator, keyboard) | ⬜ |
| 3 | Layar hasil (ringkasan, going well, focus next ≤ 3, banding diri sendiri, See details) dan aturan narasi AI (kata terlarang, langkah hari ini) | ⬜ |
| 4 | Beranda "Today" (≤ 3 item + durasi), learning days, past due tanpa merah, microcopy | ⬜ |
| 5 | Notifikasi: jam tenang, maks pengingat/hari, ringkasan harian, `ui_comfort` | ⬜ |
| 6 | Pengingat istirahat, ulasan berjeda, survei SEQ/SUS, metrik kenyamanan di dasbor admin | ⬜ |

## 17. Logo, tema, hasil tes, Learn, Journey, nama, responsif (permintaan pemilik 2026-10-11)

| ID | Item | Status |
|---|---|---|
| U1 | Logo baru dari berkas pemilik (`design/brand/logo-english-inspira-source.jpeg` → `app/public/brand/logo.png`, `logo-mark.png`, favicon, PDF, pemeliharaan) | ✅ dilihat di Chrome (landing, masuk, shell, PDF belum dibuka) |
| U2 | Tema warna mengikuti logo: navy `#0A2257`, biru `#0B4FA6`, emas `#D9A02F` (aksen oranye lama dihapus); kontras 20 pasangan lulus WCAG AA | ✅ dihitung |
| U3 | Hanya konten yang menggulung (shell `h-dvh`, ruang tes header/timer/tombol tetap), tanpa overflow samping di 5 ukuran layar | ✅ pemeriksaan otomatis di Chrome (halaman login); landing/legal memang dokumen |
| U4 | Halaman hasil sesuai desain: kartu skor + penanda target, kartu per section, selisih vs tes sebelumnya, Unduh PDF, rincian per tipe, **Konselor AI di dalam halaman** | ✅ uji klik: kirim pesan dan balasan |
| U5 | Ringkasan analisis menunjuk bagian lemah + "Courses to take next" (peta remedial → unit) | ✅ dengan 1 pemetaan uji; bergantung isi peta remedial admin |
| U6 | Learn: course sebagai kartu yang bisa dipilih; unit sebagai kartu | ✅ uji klik |
| U7 | Journey 7 tahap dari data nyata, tanpa pembelian. **Diubah 2026-10-11 (temuan QC):** halaman `/journey` dan menu My Journey dihapus, digabung sebagai strip "Your journey" di dasbor; `/journey` dialihkan ke `/home`; tahap tidak lagi memutar balik ke dasbor | ✅ uji klik 8/8 (desktop + ponsel) |
| U8 | Nama dipisah **given name** + **surname** (daftar, persetujuan, Profil); `name` = gabungan untuk tampilan; akun lama dipisah heuristik di Profil | ✅ uji klik persetujuan + smoke diperbarui; impor CSV masih satu kolom `name` |
| U9 | Tombol "Start placement" langsung ke halaman persiapan | ✅ uji klik |
| U10 | Perbaikan: label sr-only membuat halaman bisa digulung; grid melebar karena tabel; header ikut tergulung (`overflow-clip`); teks Indonesia tersisa; narasi analisis dobel; lint `/api/me` yang menggagalkan build | ✅ |
| U11 | Fokus keyboard terlihat (`:focus-visible`); uji Tab di halaman masuk, pesan galat `role=alert`, 404 ramah | ✅ uji otomatis 5/5 |
| U12 | Uji klik authoring (course, unit, soal + tag, dialog grup audio, perakit tes, materi) di browser, desktop dan ponsel | ✅ 28/28 di kedua ukuran; unggah file MP3 lewat UI belum diuji (API teruji smoke) |
| U16 | Pesan galat validasi menyebut kolom dan jelas (`lib/zod-message.ts`, 37 rute) alih-alih teks Zod mentah | ✅ unit test + terlihat di dialog |
| U17 | Dialog meluber di ponsel karena `fieldset`; course tanpa unit tidak lagi tampil ke peserta | ✅ |
| U13 | Profil: ganti foto, ubah email (OTP email baru), pengaturan notifikasi | ⬜ belum dibuat |
| U14 | Tabel admin di ponsel menjadi kartu | ⏭️ ditunda; saat ini digulung ke samping di dalam kotaknya |
| U15 | Impor peserta CSV/Excel: kolom given name + surname (atau name tunggal); `createMember` menyimpan keduanya | ✅ unit test pembacaan CSV (alias given/surname, name tunggal) |
| U18 | Beban 100 pengguna serentak (diukur lokal, build produksi, Mongo lokal): 0 galat dari ~2.900 permintaan; beranda 1 dtk, simpan jawaban p95 0,25 dtk, kirim 0,4 dtk, hasil 0,5 dtk | ✅ lokal; VPS dan Atlas belum diukur |
| U19 | Login password 100 serentak: 24,7 dtk dan server macet 18 dtk (bcryptjs di thread utama) menjadi 3,5 dtk dan jeda maks 0,1 dtk (`bcrypt` native di threadpool, cadangan bcryptjs; hash lama tetap valid; `UV_THREADPOOL_SIZE=8` di PM2) | ✅ lokal; perlu `npm ci` di VPS dan cek log `[password]` |
| U20 | Batas laju per IP dilonggarkan (login 600/10 mnt, OTP 300/jam, daftar 150/jam; env `RATE_IP_FACTOR`): satu IP kampus bersama tadinya hanya meloloskan 30 dari 100 login. Batas per email dan 5 percobaan per kode OTP tetap | ✅ |
| U21 | Antrean email: 3 pekerja paralel (dulu serial, 20 per menit); Claude: maks 8 panggilan bersamaan (`AI_CONCURRENCY`), halaman hasil menunggu analisis sampai ±3 menit | ✅ kode + OTP paralel; Claude nyata belum diuji |
| U22 | Bagian mitra ("Developed and owned by ...") dihapus dari landing atas permintaan pemilik | ✅ |

## 18. Landing interaktif, manajemen akun, Audio Library, jenis soal (permintaan pemilik 2026-10-11)

| ID | Item | Status |
|---|---|---|
| M1 | Landing: animasi (muncul saat digulir, hover angkat, tekan tombol memantul, skor menghitung naik, jawaban AI diketik, bar terisi), nav menyorot bagian aktif + gulir halus + garis emas di judul, menu mobile, teks berjalan dan logo mitra berjalan; hormati `prefers-reduced-motion` | ✅ uji Chrome desktop dan ponsel 19/19 |
| M2 | Hero landing dapat diatur di Settings admin: badge, judul, deskripsi, gambar latar + overlay, gaya teks, kartu contoh, teks berjalan, logo mitra (unggah), reset ke bawaan | ✅ uji alur admin sampai halaman publik |
| M3 | Pengguna internal (admin, coach, admin institusi): tambah, ubah nama/email/telepon, kirim tautan reset, password sementara (sekali tampil), kirim ulang undangan, nonaktif/aktif, hapus beralasan (tidak bisa hapus diri sendiri / admin terakhir / coach dengan sesi mendatang) | ✅ API 24 lulus + uji klik |
| M4 | Peserta: ubah profil, reset password (tautan / sementara), hapus beralasan lewat dialog (bug `confirm()` di dalam `disabled` yang memunculkan dialog berulang sudah dibuang) | ✅ API 9 lulus + uji klik |
| M5 | Audio Library (`/admin/audio`): unggah (jenis, deskripsi, sumber, transkrip), daftar + cari + filter jenis, pemutar + kecepatan, ubah, ganti berkas tanpa memutus tautan, hapus (ditolak bila dipakai grup soal atau materi, dengan daftar pemakai) | ✅ API 24 lulus + uji klik |
| M6 | Jenis soal dikelola per kategori (Listening, Structure, Reading): daftar bawaan ITP, tambah, ganti nama (soal ikut berubah), nonaktifkan, hapus (soal dipindah), jenis baru dari soal/impor terdaftar otomatis; bank soal punya tab kategori + filter jenis + pilih jenis di form | ✅ API 16 lulus + uji klik |
| M7 | Sisa dari `Spesifikasi_Modul_LMS_TOEFL_ITP.md`: lihat bagian 19 | ⬜ |
| M8 | Snapshot soal saat tes selesai (`AttemptSnapshot`): pembahasan dan skor tetap konsisten walau kunci/pilihan soal diubah atau soal dihapus kemudian (prinsip §11 spesifikasi) | ✅ uji: kunci 40 soal diubah setelah tes, pembahasan tetap; bug skema (`type` sebagai kata kunci Mongoose) ditemukan dan diperbaiki |
| M9 | Bank soal: duplikat, status Archived, kolom sumber/lisensi, ekspor CSV (kolom sama dengan templat impor), penanda kualitas (tanpa tag, tanpa pembahasan, Listening tanpa audio, Reading tanpa passage) | ✅ API teruji (86/86 CRUD) |

## 19. Lanjutan dari spesifikasi LMS dan audit (2026-10-11)

| ID | Item | Status |
|---|---|---|
| N1 | Audit Log (`/admin/audit`): filter kategori/pelaku/tanggal/pencarian, detail metadata, ekspor CSV; audit update soal memuat versi dan kolom yang berubah | ✅ API + uji klik |
| N2 | Riwayat versi soal: versi otomatis tiap buat/ubah/duplikat/impor, baseline untuk soal lama, perbandingan sebelum/sesudah, pulihkan (menjadi versi baru), soal tanpa perubahan tidak membuat versi | ✅ 14 uji API + uji klik |
| N3 | Preview soal seperti dilihat peserta (passage, audio, pilihan yang bisa diklik, tampilkan kunci khusus admin) | ✅ uji klik |
| N4 | Antrean tinjauan: banner jumlah soal Review, filter, Approve dan Send back per baris | ✅ uji klik |
| N5 | Test Builder: pilih soal otomatis berdasarkan jenis/kesulitan/topik (blok passage/audio utuh), acak urutan soal (blok tetap utuh), acak pilihan jawaban (indeks asli disimpan; menjawab benar semua lewat posisi tampil = skor penuh), batas percobaan; pengacakan pilihan terkunci setelah dikerjakan | ✅ 17 uji API |
| N6 | Profil: foto profil (aset pribadi, tampil juga di menu), ganti email dua langkah (kode ke email baru, pemberitahuan ke email lama, ditolak bila email sudah dipakai atau ITP aktif), preferensi email opsional (Reminders, Progress; email keamanan/akun/jadwal tetap wajib) | ✅ API + uji klik desktop dan ponsel |
| N7 | Temuan uji: Profil tidak lagi di-unmount saat muat ulang (pesan sukses hilang); foto di sidebar ikut diperbarui | ✅ |
| N8 | Scoring Profile Manager: profil konversi skor (linear atau tabel per section), editor tabel + tempel + isi linear, validasi langsung, kalkulator, versi naik dan verifikasi dicabut saat aturan berubah, verifikasi dengan sumber (linear tidak bisa diverifikasi), duplikat/default/arsip/hapus berpengaman, dipilih per tes, hasil menyimpan profil+versi+basis (verified/provisional) dan hasil lama tidak berubah | ✅ 35 uji API + 17 uji klik desktop dan ponsel + 11 unit |
| N9 | Peran staf pusat: Academic admin (konten, tes, scoring, baca peserta) dan Question editor (tulis soal/audio sampai review, tidak bisa publish/hapus/ubah soal published); menu, halaman, dan API dibatasi per peran; dibuat dari Coaches & Admins | ✅ 43 uji API + 10 uji halaman + 2 unit |
| N10 | Course tiga tingkat: Course > Modul > Unit (lesson) > Materi (sub-lesson); cover course (gambar), prasyarat course (tanpa siklus, kunci sampai semua unit prasyarat selesai), drip per unit (terbuka N hari sejak peserta memulai course), arsip/pulihkan course; progres unit terkunci tidak tercatat; kartu course dengan cover dan label Locked | ✅ 36 uji API + 13 uji klik desktop dan ponsel + 6 unit |
| N11 | Program Cycle (MTS v2.6 5.1): koleksi `programcycles` per institusi (tanggal dari kontrak/kalender, ITP opsional/wajib), status scheduled/active/closed, tanpa tumpang tindih; periode baru mewajibkan placement ulang dan mengatur ulang kuota penuh (kuota lama hangus); periode tertutup menolak tes, kuis, dan booking baru (materi tetap terbaca, progres tidak berubah); attempt, kuota, dan booking menyimpan `programCycleId`; halaman admin Program Cycles; periode pertama yang langsung aktif mengadopsi placement yang sudah ada; kuota bawaan 8/6/4 | ✅ 23 uji API + 5 uji klik desktop dan ponsel + 6 unit |
| N12 | Media Library (daftar gambar, unggah banyak, cari, ganti nama, salin URL, deteksi pemakaian di soal/materi/cover/pengaturan, hapus hanya bila tidak dipakai); impor soal dari Word (.docx, format bernomor, dipakai ulang validasi CSV); AI Question Authoring (draf soal Structure lewat Claude, ditinjau lalu disimpan sebagai draft); audio WAV (maks 30 MB), gelombang suara, dan timestamp berlabel; jadwal ITP dapat ditautkan ke periode (hanya peserta institusi itu); tabel admin jadi kartu di ponsel; skrip `align-levels` dan `reset-participants` | ✅ 34 uji API + 15 uji klik desktop + 21 ponsel + 11 unit |
| N13 | Clustering dan kelas: admin mengunggah hasil PURE/OCE (CSV/Excel atau PDF per orang), dicocokkan ke peserta lewat email atau nama (sama persis, urutan terbalik, salah ketik, nama di isi PDF), konfirmasi menetapkan level + kuota + kelas; kelas per level (kapasitas, coach, institusi, periode), penempatan acak ke kelas paling longgar, antrean menunggu kelas, pindah manual dengan riwayat, pantauan siswa aktif 7 hari dan rata-rata skor; padanan TOEFL ITP, CEFR (batas ETS), OCE, PURE di analisis hasil dan tabel padanan yang bisa diatur admin; rentang level baru Basic 310-459, Intermediate 460-559, Advanced 560-677 (skrip `align-levels`) beserta penjelasan level | ✅ 41 uji API + 10 uji klik desktop + 10 ponsel + 14 unit |
| N14 | Belum: deploy VPS (`npm ci`, jalankan `align-levels --yes`, cek log `[password]`, load test, batas unggah nginx 30 MB); batas kirim Gmail SMTP; isi tabel padanan OCE/PURE dari penyedia tes; AI authoring Listening/Reading; ganti password SSH | ⬜ |

## 20. Notulensi 11/10/2026: quick win dan plotting jadwal (2026-10-13)

| ID | Item | Status |
|---|---|---|
| O1 | Tombol Back otomatis di `ShellNav` untuk semua halaman turunan admin/coach/institusi/peserta | ✅ |
| O2 | Kategori tes baru `final` (Final Test): dinilai dan memicu kenaikan level sama seperti Simulation | ✅ |
| O3 | Impor bank soal dari Excel dengan kolom `audio`/`instruction`; baris berjudul audio sama digabung satu `question_groups`, dicocokkan ke Audio Library atau dibuat baru | ✅ |
| O4 | Kuota coaching per kategori placement naik: Basic 8→12, Intermediate 6→8, Advanced tetap 4 (`lib/config.ts`, migrasi `scripts/align-quota-2026-10.ts` dijalankan di produksi, hanya mengubah dokumen yang masih memakai nilai bawaan lama) | ✅ |
| O5 | Penentuan jadwal coaching massal dari Excel: admin memplot kelas + jadwal sekaligus (`lib/import-schedule.ts`, `/api/admin/coaching/import`), baris coach+waktu sama digabung satu sesi, tiap peserta dibooking lewat `bookSlot` yang sama dengan booking mandiri (kuota/bentrok/kapasitas tetap dicek), baris gagal dilaporkan per baris | ✅ 8 smoke checks baru (301/317 total lulus; 16 gagal pra-ada, tidak terkait) |
| O6 | Impor peserta dari Excel multi-sheet dan header fleksibel (`email_kantor`/`email_pribadi`/`no_hp`, dst.) dengan pemrosesan paralel untuk ribuan baris | ✅ diuji dengan berkas 1.381 baris, 0 gagal |
| O7 | MTS diperbarui ke v2.8 (`English_Inspira_LMS_MTS_V2_8.md`, dari acuan v2.7 yang sebenarnya — v2.4/v2.5/v2.6 lama adalah berkas yatim yang sempat salah diacu) mencakup O1-O5 ditambah catatan captcha dan pendaftaran satu langkah yang sudah berjalan di produksi | ✅ |
| O9 | Email undangan untuk staf pusat: menambah admin/academic admin/question editor kini mengirim email `staff_invitation` dengan tautan membuat password (7 hari, sekali pakai); `Invitation.institutionId` tidak lagi wajib. Juga diperbaiki hari ini: link anchor di materi HTML (jembatan iframe), captcha diizinkan saat mode pemeliharaan, captcha bawaan lebih terbaca, antre ulang 846 undangan gagal | ✅ 138 unit |
| O10 | QA tester dan Test mode: `users.qaTester` (diatur di detail peserta, badge QA) dan `tests.testMode` (checkbox di form tes; form tes baru default Active mati + Test mode menyala). Peserta biasa tidak melihat/memulai tes Test mode (daftar tes, start, kuis unit, langkah placement di Home); admin dan QA tester bisa, QA tester bebas dari aturan placement/level/periode/batas percobaan | ✅ 140 unit |
| O11 | Perbaikan dari laporan QA peserta 17 Okt: audio Listening hanya bisa diputar di soal pertama (AudioBox tanpa `key`, status "done" terbawa ke soal berikutnya); tag label batch (`oce`, `test-NN`) dan format (`written-expression`) tidak lagi dihitung sebagai topik belajar (statistik, analisis, study plan, ringkasan institusi); refresh di ruang tes kembali ke soal terakhir (bukan soal 1). Belum: konversi skor Provisional, isi Course/Materials/jadwal, uji dengar audio langsung | ✅ 142 unit, uji dengar audio oleh QA masih perlu |
| O12 | Acak soal di dalam bagian (`shuffleWithinParts`): urutan soal berbeda per peserta tetapi Part A/B/C dan Structure/Written Expression terjaga (bagian dari tag soal); satu fungsi `orderQuestions` untuk tampilan soal dan Secure mode; opsi di form tes (saling eksklusif dengan acak biasa); perubahan dikunci saat peserta sungguhan sedang mengerjakan. Form tes juga kini menampilkan Test rules untuk Placement dan percobaan QA tidak lagi mengunci tes. Diverifikasi pada data T01 asli (300 percobaan x 3 section) | ✅ 145 unit |
| O8 | Terbuka, menunggu pemilik: makna "OSEE", KTP wajib untuk semua peserta atau hanya ITP resmi, konsep dashboard analitik manajemen (Pak Yudha/Pak Azwar), §27 Kenyamanan Belajar dibatalkan (tidak diterapkan) | ⬜ |

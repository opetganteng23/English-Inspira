# TODO Edulyfe EPTA — acuan: English_Inspira_LMS_MTS_V2_2.md

Legenda status: ✅ Sudah · 🔄 Sedang · ⬜ Belum · ⏭️ Sengaja dilewati/ditunda (alasan wajib) · ❌ Dihapus karena bertentangan dengan v2.2
Prioritas: **P1** fondasi (Fase 1+3) → **P2** belajar & analitik (Fase 4+5) → **P3** coaching (Fase 6) → **P4** PDF/level-up/laporan/hardening (Fase 7+8) → **P5** opsional (Fase 9, sudah ada)

Aturan: setiap perubahan dicatat di sini. Status "✅" hanya bila sudah dijalankan/diuji, bukan sekadar ditulis.

## 0. Keputusan yang dikonfirmasi pemilik

| # | Keputusan | Status |
|---|---|---|
| K1 | **MTS v2.2 adalah acuan resmi.** Model v1 (jual paket, Midtrans, voucher, free trial, daftar publik) dibuang | ✅ dikonfirmasi |
| K2 | Soal Listening boleh membawa audio (via grup soal; MP3 di GridFS) | ✅ sudah didukung; unggah audio langsung di editor soal = T-AUD |
| K3 | Deploy: Biznet Gio Cloud + PM2 (satu instance) + Nginx | ✅ dokumen siap (README, `ecosystem.config.cjs`, `deploy/`) |
| K4 | Bentuk **pure-analytics** (library/service) | ⬜ menunggu modul/kontrak. Sementara: perhitungan angka di kode sendiri (adapter §14) |
| K5 | Angka level, tabel konversi skor resmi, retensi data, kuota Konselor | ⬜ placeholder dari MTS §5; admin dapat mengubah lewat Parameter Sistem |
| K6 | Nama produk: "Edulyfe EPTA" (UI) vs "English Inspira" (judul MTS) | ⬜ perlu konfirmasi |

## 1. Pembuangan model v1 (❌ → hapus) — P1

| ID | Item | Status |
|---|---|---|
| R1 | Koleksi `products`, `vouchers`, `orders`, `entitlements`, `leads` + seed produk | ✅ model & rute dihapus |
| R2 | Midtrans, webhook, `/api/checkout`, `/api/cart`, `/api/orders`, invoice PDF, mode simulasi bayar | ✅ rute, Midtrans, invoice PDF dihapus |
| R3 | Free trial (diganti placement), pendaftaran publik `/daftar`, landing publik, kode institusi self-join | ✅ `/daftar` 404 (teruji), self-join dihapus, `/` hanya mengalihkan |
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
| README, PM2 (`ecosystem.config.cjs`), Nginx, Docker, `/api/health` | ✅ (Docker belum diuji build) |
| Uji unit (vitest, 60 uji) & `scripts/smoke.mjs` v2.2 (273 pemeriksaan API, semua lulus) | ✅ |
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
| Pemeriksaan smoke "OTP tidak dikirim ke peserta yang aksesnya berakhir" kondisinya lemah (membandingkan posisi log) | ⬜ perketat |

## 11. Cakupan verifikasi (jujur)

| Area | Status |
|---|---|
| Semua API alur v2.2 (undangan, consent, placement→level→kuota, isolasi, kedaluwarsa, hak data) | ✅ teruji otomatis |
| Halaman UI baru/ditulis ulang (masuk, persetujuan, beranda, tes, hasil, profil, admin, institusi, coach) | 🔄 lolos build & lint, **belum dibuka di browser** |
| Responsif 9:16 s.d. 16:9 | ⬜ belum diuji (Playwright ditunda atas permintaan pemilik) |
| Timer server saat waktu habis, Docker build, email/AI/DB nyata | ⬜ menunggu kunci & URL DB |

## 12. Sisa pekerjaan

Keadaan terakhir: `tsc`, `next build` (59 halaman) dan lint bersih; vitest 60 uji; smoke 273/273 (semua API alur v2.2 termasuk ITP).

| Prioritas | Item | Status |
|---|---|---|
| P1 | Buka seluruh UI baru di browser + uji responsif 9:16 s.d. 16:9 (Playwright) | ⬜ (belum dijalankan; ditunda atas permintaan pemilik) |
| P2 | L10 uji keamanan iframe di browser (akses parent/storage/cookie, jaringan, navigasi, popup) | ⬜ |
| P3 | Uji panggilan Claude nyata, SMTP nyata, MongoDB nyata, node-cron di PM2, build Docker (menunggu kunci & URL DB) | ⬜ |
| P3 | OCR untuk PDF hasil scan | ⬜ |
| P3 | Perketat uji smoke "OTP tidak dikirim ke peserta yang aksesnya berakhir" | ⬜ |
| – | Keputusan pemilik: K4 pure-analytics, K5 angka resmi (level, konversi skor, retensi, kuota), K6 nama produk | ⬜ |

# English Inspira AI LMS — Master Technical Specification v2.9 (MTS)

Versi 2.9 (30 Oktober 2026) · Pembaruan dari MTS v2.8 · LMS persiapan **EPTA (English Proficiency Test & Analytics)** berbasis level, kerja sama institusi mitra, tanpa jalur komersial · Status implementasi: produksi di english.edulyfe.id

## 0. Riwayat Perubahan

| Versi | Perubahan utama |
| --- | --- |
| 2.0 | Peralihan ke model institusi mitra, role coach, analitik berkelanjutan, dan penghapusan alur komersial. |
| 2.1 | Penegasan bahwa coach adalah penentu jadwal dan peserta hanya memilih slot yang telah diterbitkan. |
| 2.2 | Perubahan keamanan materi HTML: JavaScript materi tidak lagi dijalankan di origin/hak aplikasi utama. Materi interaktif dijalankan dalam iframe sandbox terisolasi dengan CSP ketat dan jembatan analitik terbatas. |
| 2.3 | Diselaraskan dengan implementasi (Oktober 2026): seluruh antarmuka dan URL berbahasa Inggris; nama produk **English Inspira** dengan logo Inspira dan font Poppins; landing page publik; login **password atau OTP**; **daftar mandiri wajib kode institusi** + verifikasi email; lupa/reset password; **mode pemeliharaan** dengan login khusus admin `/admin/login`; keluaran Claude terstruktur lewat tool use; deploy **PM2 tanpa Docker**. Lihat bagian 0.2. |
| 2.4 | **Kenyamanan belajar dan psikologi UI** (bagian 27): prinsip berbasis teori (beban kognitif, motivasi, kecemasan tes, umpan balik), design token tenang, mode fokus, ruang tes yang menurunkan kecemasan, penyajian hasil yang tidak menghakimi, panduan microcopy, notifikasi dengan jam tenang, aksesibilitas, parameter `ui_comfort`, metrik kenyamanan, dan kriteria penerimaan tambahan. Tidak mengubah aturan skor, keamanan, atau RBAC. |
| 2.5 | **Scoring Profile Manager** (Oktober 2026): `score_conversion` tunggal diganti koleksi `scoring_profiles` (mode linear atau tabel per section, versi, status terverifikasi dengan sumber, default, arsip). Tes memilih profil; attempt menyimpan `scoringProfileId`, `scoringVersion`, dan `scoreBasis` (`verified` atau `provisional`). Mengubah aturan konversi menaikkan versi dan mencabut verifikasi; hasil lama tidak dihitung ulang. Profil linear tidak dapat diverifikasi. Tidak mengubah RBAC atau keamanan. |
| 2.6 | **Program Cycle & Coaching Quota**: periode program mengikuti kontrak atau kalender institusi; jadwal ITP resmi dapat dikonfigurasi per institusi/periode; diagnostik awal wajib diulang pada periode baru; materi course periode lama menjadi read-only setelah periode ditutup, sedangkan aktivitas yang dinilai ditutup; kuota coaching per periode ditetapkan dari kategori placement test (Basic 8, Intermediate 6, Advanced 4) dan di-reset penuh saat periode baru tanpa carry-over. Histori periode lama dipertahankan dan akses tetap dibatasi enrollment/kontrak. | Implementasi (Oktober 2026): halaman admin Program Cycles, placement wajib ulang per periode, reset kuota, penutupan periode, `programCycleId` pada attempt, kuota, dan booking. Ditambah peran `academic_admin` dan `content_editor` (bagian 4) dan struktur course Course > Modul > Unit > Materi dengan cover, prasyarat, drip, dan arsip (bagian 10.1). |
| 2.7 | **Clustering, kelas, dan alat konten** (Oktober 2026): hasil OCE/PURE diunggah admin dan dicocokkan ke peserta; skor menetapkan level, kuota, dan kelas (bagian 5.2); rentang level final Basic 310-459, Intermediate 460-559, Advanced 560-677; padanan skor TOEFL ITP, CEFR, OCE, PURE di analisis hasil; Media Library, impor soal dari Word, draf soal dengan AI, audio WAV dengan gelombang suara dan penanda waktu (bagian 10.4, 11); jadwal ITP dapat ditautkan ke periode; tabel admin tampil sebagai kartu di ponsel; skrip operasional `align-levels` dan `reset-participants` (bagian 22). |
| 2.8 | **Captcha, kuota 12/8/4, Final Test, dan impor jadwal massal** (Oktober 2026, dari notulensi 11/10/2026): captcha (Turnstile atau SVG bawaan) menggantikan verifikasi kode email pada daftar/login/lupa password, pendaftaran mandiri jadi satu langkah (bagian 7.1, 8.1); kuota coaching per kategori placement naik jadi Basic 12, Intermediate 8, Advanced 4 (bagian 5, 12); kategori tes baru **Final Test** (`tests.kind = 'final'`), dinilai dan memicu kenaikan level sama seperti Simulation (bagian 11); impor bank soal Excel menerima kolom audio dan membuat `question_groups` otomatis (bagian 10.4); admin dapat **memplot kelas dan jadwal coaching sekaligus dari Excel**, memakai ulang aturan kuota/bentrok/kapasitas booking manual (bagian 16.5); tombol Back otomatis di semua halaman turunan admin/coach/institusi/peserta (bagian 21); §27 (Kenyamanan Belajar dan Psikologi UI) **dibatalkan pemilik, tidak diterapkan** — tetap sebagai referensi desain; logo tunggal (opsi desain ketiga, bagian 26). |
| 2.9 | **Pelaksanaan placement AirNav, EPTA, dan database mandiri** (18-30 Oktober 2026): rebrand tampilan TOEFL ITP menjadi **EPTA**; penahanan hasil placement per institusi dengan **opsi cakupan** (peserta dan coach saja, atau juga admin institusi); Class otomatis dari placement; data kepegawaian HR per institusi; ruang tes mode aman yang tahan koneksi lambat (simpan berurutan, posisi soal atomik, waktu offline dikembalikan, audio diunduh penuh dan Web Audio dengan cadangan); Monitoring & Proctoring live, proctoring per soal, live screen view, void/restore/terminate attempt; laporan Excel per tes dan **Executive Summary PowerPoint**, analytics per umur/cabang/provinsi/tanggal, narasi analisis per peserta (AI, bahasa Indonesia); portal institusi dengan dasbor peserta, data personel, analisis AI, dan **catatan coach**; **database dipindah dari Atlas ke instance MongoDB khusus di VPS**; deploy tanpa jeda; indikator loading global. Lihat bagian 0.3. |

## 0.3 Perubahan dari v2.8 ke v2.9

Bagian ini merangkum seluruh perubahan sejak v2.8 (17 Oktober 2026) sampai 30 Oktober 2026. Bila bertentangan dengan bagian lain dokumen ini, bagian 0.3 yang berlaku.

### 0.3.1 Merek dan istilah

| Area | v2.8 | v2.9 |
| --- | --- | --- |
| Nama produk | English Inspira | **English Inspira AI**, logo baru dan favicon lambang Ai, sidebar cloud white |
| Nama tes | TOEFL ITP | **EPTA (English Proficiency Test & Analytics)** di semua teks yang dilihat pengguna: UI, laporan, Excel, PowerPoint, email, sertifikat. Nomor sertifikat resmi `EPTA-OFC-<tahun>-<urut>`, laporan simulasi `EPTA-RPT-…` |
| AI | Bebas menyebut TOEFL | Prompt sistem melarang menyebut TOEFL, TOEFL ITP, ITP, atau ETS; tes disebut EPTA |
| Kode internal | `itp*` | **Tetap** (`ItpSession`, `itpTotal`, rute `/itp`, dll.) agar tidak memecah data dan tautan lama |
| Skala | 310-677 | Tetap 310-677, bagian 31-68. Padanan CEFR ditampilkan di laporan sebagai informasi |
| Hasil kelas | PURE/OCE Results | **Class Results** (istilah PURE/OCE dihapus dari tampilan) |

### 0.3.2 Penahanan hasil placement per institusi (Hold)

- `institutions.holdPlacementResults` (Boolean): placement peserta institusi itu disimpan dengan `attempts.heldByOrg = true` dan `releaseAt = HOLD_UNTIL` sampai admin pusat melepas. Pelepasan bisa sekaligus (matikan Hold) atau per peserta; efek hasil (level, kuota, Class, email, analisis) dijalankan saat rilis (`attempts.releasedAt`).
- **Cakupan penahanan (baru)**: `institutions.holdFromInstAdmin` (Boolean, default `true`).
  - `true`: hasil tersembunyi untuk peserta, coach, **dan admin institusi**.
  - `false`: tersembunyi untuk peserta dan coach saja; **admin institusi melihat** skor, level, laporan, analytics, dan Excel.
  - Diatur di Admin → Institutions → Edit → "Who the hold applies to". Admin pusat dan QA tester tidak pernah tertahan.
- Semua jalur yang membaca skor wajib menghormati penahanan: halaman hasil, beranda, daftar tes, journey, Konselor AI (skor ditahan tidak masuk konteks AI dan AI dilarang menebak), saran jadwal EPTA resmi (`/api/itp/sessions`, diperbaiki v2.9 setelah skor sempat terlihat), dasbor coach, portal institusi.
- Selama ditahan, Class tetap dibentuk dari skor saat tes selesai; nama level dan Class baru terlihat setelah rilis.
- Admin Participants menampilkan skor/level yang belum dirilis dengan tanda "held" atau jam rilis.

### 0.3.3 Class otomatis dan data kepegawaian

- Placement di aplikasi langsung menempatkan peserta ke Class level-nya (juga saat hasil ditahan dirilis). Bila kelas penuh atau belum ada, dibuat kelas baru (nama level + huruf, 70 kursi; parameter `class_auto`). Penempatan berurutan agar tidak dobel.
- **Data personel HR** per institusi (Admin → Institutions → Personnel data): impor Excel dengan pratinjau, dicocokkan lewat email. Field di `users`: `branch`, `city`, `province`, `birthPlace`, `birthDate`, `gender`, `employmentStatus`, `jobTitle`, `education`, `phone`. **NIK dan email pribadi tidak disimpan.** Peserta tanpa pasangan di data personel tampil sebagai "No personnel data" di analytics dan laporan.

### 0.3.4 Ruang tes (mode aman searah) dan ketahanan koneksi

- Mode aman (`secure`): satu arah, tidak bisa kembali; tombol Flag dan warna oranye dihapus; pemberitahuan searah di halaman persiapan dan awal tiap bagian; dialog tutup bagian hanya Cancel/Finish; menutup bagian dengan soal kosong wajib centang konfirmasi.
- **Posisi soal** `attempts.secureReached` ditulis **atomik**: `updateOne({_id, status: "in_progress", sectionIdx}, {$max: {secureReached}})`. Simpanan lambat dari bagian sebelumnya tidak dapat mengunci soal awal bagian berikutnya (bug "mulai di nomor 40").
- Tutup bagian **idempoten** (`fromIdx`); permintaan tutup kurang dari 3 detik setelah bagian dibuka dianggap ganda.
- Simpanan jawaban berurutan, dibatasi 15 detik lalu dicoba ulang; Next menunggu simpanan tersimpan; cadangan jawaban di browser dikirim ulang setelah online/refresh; server menerima jawaban pertama yang terlambat untuk soal kosong yang baru dilewati. Soal yang dilewati tanpa memilih dicatat sebagai dilewati.
- Indikator koneksi Online/Slow/Offline; saat offline soal ditutup dan timer dijeda; waktu yang hilang (offline atau share layar terputus) dikembalikan server, maksimal 10 menit per bagian.
- Pemberitahuan "Saving your answer… / Moving to the next section… / Submitting your test… Do not refresh or close this page" bila proses lebih dari 1 detik; peringatan sebelum menutup halaman. Submit/Finish section dibatasi 30 detik lalu keadaan dimuat ulang (tidak menggantung). Respons 409 tidak menahan status "Saving…".
- Halaman persiapan menampilkan langkah yang belum dipenuhi di atas tombol Start (tes audio, aturan, share layar).
- **Audio Listening**: diunduh penuh sejak soal tampil lalu diputar dari memori lewat Web Audio (jalur sama dengan test tone) dengan bar level; bila Web Audio macet dalam 2,5 detik otomatis pindah ke `<audio>`; tombol "No sound? Switch audio player" melanjutkan dari posisi sekarang. Tanda selesai ditolak server sebelum 80% durasi; klip senyap tidak dihitung; suara dobel dicegah. Audio disajikan dari disk server setelah diunduh sekali dari GridFS.
- Kompatibilitas Safari/Mac (izin audio saat klik, layar penuh webkit).

### 0.3.5 Proctoring, monitoring, dan penanganan attempt

- **Monitoring & Proctoring** live: tabel dengan cari/filter/urut/halaman, tandai massal, export CSV; status sambungan dari heartbeat 30 detik; skor risiko; panel Trace; deteksi bagian yang mulai di tengah dan soal kosong terselip (pemeriksaan otomatis tiap jam).
- **Proctoring per soal**: timeline waktu per soal, benar/salah, ganti jawaban, tebakan, pindah tab/keluar layar penuh/paste dengan jam dan nomor soal.
- **Live screen view** per tes (default mati): peserta laptop/PC membagikan seluruh layar; admin dan admin institusi melihat grid layar live. Gambar hanya disimpan di memori server, tidak direkam.
- Admin: **Void attempt** (arsip dengan alasan, keluar dari hasil, kelas dilepas, peserta bisa tes ulang), **Restore** (ditolak bila sudah ada percobaan baru), **Terminate & score / Reset** untuk tes yang nyangkut. Semua tercatat di audit.
- Kunci salah password terbuka otomatis setelah reset password; pesan 429 menjelaskan sisa waktu.

### 0.3.6 Jadwal tes

- Undangan dikirim per sesi (urut jam buka) dan pengingat otomatis per tes.
- Papan jadwal: cari peserta lintas sesi, pindah sesi/reschedule dari hasil pencarian, export per sesi.
- **Rekap perubahan jadwal**: riwayat pindah sesi per peserta (asal, tujuan, waktu, oleh, alasan opsional; Undo), sheet Excel "Schedule changes", slide di Executive Summary.
- Portal institusi: papan jadwal identik dengan admin (hanya lihat, hanya peserta institusinya).

### 0.3.7 Laporan dan analytics

- **Excel hasil per tes**: Results (skor, bagian, CEFR, level, jadwal, kehadiran, proctoring), Attendance, rekap per hari dan level, Schedule changes, **Individual analysis** (narasi bahasa Indonesia per peserta: ringkasan, kelebihan, kelemahan, rencana belajar, target; sumber "Analisis AI" atau "Skor per topik").
- **Narasi per peserta**: `attempts.reportNarrative` dibuat oleh `scripts/gen-report-narratives.ts` lewat Claude (hanya angka yang dikirim ke AI, tanpa nama/email/cabang); cadangan `templateNarrative` bila AI tidak tersedia.
- **Executive Summary PowerPoint** (per sesi/hari/rentang): kehadiran, rekap jadwal, sebaran skor, posisi terhadap target, level/CEFR, bagian, kekuatan dan kelemahan per topik, kelemahan per level, profil per level, perbandingan per umur/cabang/provinsi/tanggal, pola pengerjaan, integritas, skor tertinggi dan terendah dengan analisis, rekomendasi, lampiran. Sampul mengikuti tanggal yang dipilih.
- **Analytics** per kelompok umur, cabang, provinsi, dan tanggal tes dengan peta; dialog Download report (format, cakupan, tanggal: semua/satu/rentang).
- Kinerja: query laporan hanya membaca kolom yang dipakai (jumlah jawaban dan catatan proctoring dihitung di MongoDB), indeks `attempts {testId, startedAt}` dan `{status, kind, testId}`, cache hasil analytics 60 detik per filter dan hasil siap 5 menit.

### 0.3.8 Portal institusi dan RBAC

- Dasbor peserta untuk admin pusat dan admin institusi (`lib/staff-view.ts`, `components/StaffParticipantView.tsx`): level, skor, kuota, progres, kelemahan/kekuatan topik, semua tes, laporan lengkap per tes (skor per bagian, benar/salah, kelemahan, **narasi dan analisis AI**, PDF), study plan.
- **Data personel** (HP, tanggal/tempat lahir, jenis kelamin, jabatan, status, pendidikan, cabang, kota, provinsi) terlihat oleh admin pusat dan admin institusi peserta itu (NDA).
- **Catatan coach** (v2.9): admin institusi (pimpinan lembaga pelatihan) dan admin pusat melihat catatan sesi `shared` (untuk peserta) dan `private` (internal), berlabel jelas. Menggantikan aturan lama "inst_admin tidak melihat analisis individu dan catatan sesi".
- Setiap akses admin institusi ke data individu dicatat di audit log. Data institusi lain tetap tertutup (filter di query).
- Admin Participants: kartu per institusi, pagination lengkap, filter placement/tanggal/level, urut kolom. Coaches & Admins: ubah peran dan institusi dengan pengaman admin terakhir.
- Akun QA tidak dihitung di statistik.

### 0.3.9 Infrastruktur dan operasional

- **Database**: dipindah dari MongoDB Atlas ke **instance MongoDB 7.0 khusus EPTA di VPS** (29 Oktober 2026). Alasan: koneksi ke Atlas tier bersama sekitar 85 KB/s membuat Analytics 502/504; setelah pindah, membaca seluruh attempt turun dari 293 detik ke sekitar 2 detik.
  - Service `mongod-epta`, port **27018**, `bindIp 127.0.0.1`, data `/var/lib/mongodb-epta`, `authorization: enabled`, cache WiredTiger 1 GB. **Terpisah** dari mongod bawaan (27017) yang dipakai aplikasi lain.
  - User `eptaApp` (readWrite `edulyfe-epta`) untuk aplikasi, `eptaAdmin` (root) untuk admin. Rahasia di `/home/Inspira/db-migrate/epta-db.secret` (mode 600).
  - Akses dari luar hanya lewat SSH tunnel: `ssh -N -L 27018:127.0.0.1:27018 Inspira@103.150.227.58`.
  - Atlas dipertahankan sebagai arsip; rollback dengan `.env.local.bak-atlas`.
  - **Backup**: `/home/Inspira/db-migrate/backup-epta.sh` (mongodump gzip, simpan 7 terakhir di `/home/Inspira/db-backup`). Jadwal cron harian 02:00 WIB (`0 19 * * *` UTC) dipasang oleh pemilik server. Disarankan salinan mingguan ke luar server.
- **Deploy tanpa jeda** (`redeploy-english`): build ke `.next-build` lalu ditukar, `npm ci` hanya bila package-lock berubah, otomatis kembali ke build lama bila gagal kesehatan. `FORCE=1 redeploy-english` untuk build ulang tanpa commit baru. Berkas sementara tidak boleh ditinggal di `scripts/` server (ikut type-check).
- PM2 `max_memory_restart` 900 MB; Nginx timeout 60 detik: laporan berat dibuat lewat skrip di server bila perlu.
- **Indikator loading global** (`components/BusyBar.tsx`): garis tipis di atas layar dan kursor progress saat pindah halaman dan saat fetch yang dipicu klik/ketik lebih dari 150 ms; fetch latar dan ruang tes dikecualikan.
- Gambar latar panel merek dari Settings (base64 di database).

### 0.3.10 Keputusan pemilik (v2.9)

- Skor peserta yang terdampak bug jawaban hilang **tidak dikompensasi**; skor dibiarkan asli (fungsi kompensasi dihapus).
- Pimpinan institusi berhak atas data personel, analisis AI per orang, dan catatan coach peserta institusinya. Data lintas institusi tetap tidak dibuka.
- Top-up kredit AI ditunda karena biaya; narasi yang sudah dibuat tersimpan di database.

## 0.1 Perubahan dari v1

| Area | v1 | v2.2 |
| --- | --- | --- |
| Model bisnis | Jual paket ke publik (Midtrans, voucher, keranjang) | **Tanpa pembayaran.** Peserta masuk lewat institusi mitra |
| Pendaftaran | Publik + free trial | **Hanya diundang atau diimpor.** Tidak ada pendaftaran publik |
| Acuan level | Skor ITP | Skor ITP saja (**tanpa CEFR**), dibagi Basic / Intermediate / Advanced |
| Role | participant, admin, inst\_admin | Ditambah **coach** |
| Belajar | Materi datar | Level → course → unit, syarat lulus, aturan naik level |
| Coaching | Tidak ada | Slot dibuat coach, booking, kuota 8/6/4, kehadiran, catatan sesi |
| Analisis | Setelah submit tes | **Setiap selesai mengerjakan**, akumulatif, narasi, study plan berdeadline |
| Mesin analitik | Claude API | **pure-analytics** (menghitung) + Claude API (narasi) + upload PDF |
| Materi HTML | iframe sandbox | **iframe sandbox terisolasi, CSP ketat, tanpa akses langsung ke origin aplikasi** |
| ITP resmi dan sertifikat | Inti produk | **Opsional** (Fase 9) |

**Dihapus:** koleksi `products`, `vouchers`, `orders`, `leads`; Midtrans dan webhook; free trial; layar paket, keranjang, checkout, riwayat transaksi; modul admin transaksi, paket, voucher.

## 0.2 Perubahan dari v2.2 ke v2.3

| Area | v2.2 | v2.3 |
| --- | --- | --- |
| Bahasa | Bahasa Indonesia | **Bahasa Inggris** untuk semua teks pengguna: UI, pesan error API, email, PDF, prompt dan jawaban AI, preset materi. Tanpa tanda panah dan em dash di teks tampilan (bagian 26) |
| URL | `/masuk`, `/beranda`, `/tes`, … | **URL bahasa Inggris** (`/sign-in`, `/home`, `/tests`, …). URL lama dialihkan permanen (308) agar tautan di email lama tetap jalan (bagian 21.1) |
| Merek | "Edulyfe EPTA" di UI | **English Inspira** "by Inspira Teknologi", logo Inspira, favicon logo saja, font **Poppins** saja (web, email, PDF, iframe materi) |
| Halaman publik | `/` langsung ke halaman masuk | **Landing page** (bagian 26.1). Tanpa harga, pembayaran, atau free trial |
| Login | OTP email saja | **Password atau OTP email** (bagian 7) |
| Pendaftaran | Hanya diundang/diimpor | Diundang/diimpor, **atau daftar mandiri dengan kode institusi** + verifikasi email (bagian 8.1) |
| Lupa password | Tidak ada | Tautan reset 30 menit, sekali pakai (bagian 7) |
| Pemeliharaan | Tidak ada | **Mode pemeliharaan** dari dasbor admin; login admin di `/admin/login` (bagian 20.1) |
| Keluaran AI | Teks JSON diurai | **Tool use** dengan skema (keluaran terstruktur), tidak bisa rusak karena tanda kutip (bagian 13.5, 17) |
| Deploy | VPS Docker atau Vercel | **VPS + PM2 + Nginx, tanpa Docker**; skrip `redeploy-english` (bagian 22) |

## 1. Ringkasan Produk

Alur peserta:

**Landing page → Daftar dengan kode institusi atau undangan → Login (password atau OTP) → Persetujuan data → Placement test (format ITP) → Level → Kuota coaching + study plan awal → Belajar course dan kuis (hasil dan analisis muncul setiap selesai mengerjakan) → Sesi coaching → Simulasi ITP berkala → Naik level → (opsional) ITP resmi dan sertifikat**

Tiga jalur di atas satu fondasi:

| Lapisan | Isi |
| --- | --- |
| Fondasi | Akun (password + OTP), RBAC, institusi, enrollment, bank soal bertag, mesin tes, audio, aset, audit log |
| Jalur A: Tes ITP | Placement test, simulasi berkala, skor 310-677, proctoring ringan |
| Jalur B: Belajar mandiri | Level → course → unit → materi dan kuis → syarat lulus |
| Jalur C: Coaching | Slot coach, booking, kuota, kehadiran, catatan sesi |
| Otak analitik | Event tracking, analisis, narasi, pemetaan remedial, study plan, Konselor AI |

## 2. Keputusan Teknis Wajib

| Area | Keputusan |
| --- | --- |
| Database | **MongoDB 7.0 self-hosted di VPS** (instance khusus `mongod-epta`, port 27018, auth wajib; sejak v2.9, sebelumnya Atlas), ODM Mongoose. **GridFS** untuk audio |
| Email | **Nodemailer + SMTP Gmail memakai App Password** (akun dengan 2-Step Verification) |
| Gambar dan aset | Dikompres dan dikonversi ke **base64** di klien, disimpan di koleksi `assets` MongoDB |
| Materi | Dua mode: **Rich Text sangat lengkap** (TipTap) atau **HTML interaktif** dalam iframe sandbox terisolasi |
| AI | Claude API (Anthropic): analisis hasil belajar, narasi dan sugesti, serta Konselor AI. Kunci hanya di server |
| Mesin analitik | **pure-analytics** (perhitungan angka dan akumulasi, bila dipakai). Analisisnya oleh Claude API, lihat bagian 13.5 dan 14 |
| Acuan level | Skor **EPTA** 310-677 (skala setara format ITP). CEFR hanya sebagai padanan informasi di laporan |
| Akses | Hanya peserta dari institusi mitra (undangan atau kode institusi). **Tanpa pembayaran online** |
| Bahasa | **Inggris** untuk semua teks yang dilihat pengguna. Komentar kode dan dokumen internal boleh berbahasa Indonesia |
| Deploy | VPS (Biznet Gio) + **PM2** satu instance + Nginx. **Tanpa Docker** |

## 3. Stack

- **Frontend dan backend**: Next.js 14 (App Router) + TypeScript + Tailwind, satu repo, Route Handlers. Font **Poppins** saja (berkas lokal; PDF memakai TTF karena fontkit gagal men-subset WOFF2).
- **Auth**: password (bcrypt) **atau** OTP email 6 digit (kedaluwarsa 5 menit), lalu sesi JWT di cookie `httpOnly` (`jose`).
- **Editor materi**: TipTap (Rich Text) + CodeMirror (mode HTML).
- **Validasi dan pembatasan**: Zod, `rate-limiter-flexible`, `mongo-sanitize`.
- **Job dan reminder**: `node-cron` (BullMQ + Redis opsional bila antrean besar).
- **Keamanan materi HTML**: iframe `sandbox` dengan origin opaque, Content Security Policy (CSP), validasi payload `postMessage`, dan allowlist aset. Pemrosesan CSS untuk preview/editor boleh memakai `postcss` + `postcss-prefix-selector`, tetapi bukan sebagai batas keamanan.
- **Impor dan ekspor**: `papaparse` (CSV), `exceljs` (Excel), generator PDF untuk laporan.
- **PDF masuk**: `pdf-parse` v2 (kelas `PDFParse`), OCR opsional untuk PDF hasil scan.
- **Penjadwal**: `node-cron` di dalam proses lewat `instrumentation.ts` (`experimental.instrumentationHook`), modul Node dipisah di `lib/scheduler.ts` agar bundel edge bersih.

## 4. Peran dan Hak Akses (RBAC)

| Peran | Cakupan data | Fungsi utama |
| --- | --- | --- |
| `participant` | Datanya sendiri | Placement, course, kuis, simulasi, melihat dan booking slot coaching yang tersedia, hasil dan analisis, study plan, Konselor AI |
| `coach` | Peserta institusinya yang berada di kelas atau slotnya | Menentukan dan mengelola jadwal/slot coaching, kehadiran, profil peserta, laporan pra-sesi, catatan sesi, ubah study plan, rekomendasi naik level |
| `inst_admin` | Institusinya saja | Pimpinan lembaga pelatihan mitra. Impor dan undang peserta, dasbor dan analytics, daftar dan dasbor per peserta (data personel, hasil, laporan lengkap dengan analisis AI, catatan coach), monitoring dan live screen, jadwal (lihat), laporan Excel/PDF. Hasil yang ditahan mengikuti `holdFromInstAdmin` |
| `admin` | Semua institusi | Semua konfigurasi, konten, bank soal, kelas, penugasan coach, monitoring, laporan, materi HTML interaktif terisolasi |
| `academic_admin` | Pusat (lintas institusi), tanpa institusi | Mengelola dan mem-publish bank soal, audio, tes, course, unit, materi rich text, remedial map, dan Scoring Profiles; membaca daftar peserta. Tidak dapat mengelola akun, institusi, parameter, pengaturan, audit log, mode pemeliharaan, Program Cycles, atau materi HTML |
| `content_editor` | Pusat, tanpa institusi | Menulis soal dan audio sampai status `draft` atau `review`. Tidak dapat mem-publish, mengubah soal yang sudah published atau archived, atau menghapus; hanya melihat menu Question Bank dan Audio Library |

**Aturan wajib**

- **Konten hanya dikelola `admin` pusat** (keputusan pemilik, v2.4): bank soal, audio, materi (rich text maupun HTML), lampiran, tes, course, unit, dan remedial map. `coach` dan `inst_admin` tidak dapat membuat atau mengubah konten; coach memandu peserta lewat sesi, catatan, dan item study plan. Tujuannya standar skor dan kualitas materi sama di semua institusi. Materi ber-`institutionId` yang sudah ada tetap terlihat oleh peserta institusinya dan dikelola admin.

- `institutionId` wajib untuk `participant`, `coach`, `inst_admin`. Hanya `admin` tanpa institusi.
- Middleware `requireRole([...])` dan `scopeByInstitution(user)` dipanggil di **setiap** handler. Filter institusi wajib di level query, bukan hanya di UI.
- Satu coach melayani satu institusi. Coach yang melatih dua mitra memakai dua akun.
- `inst_admin` melihat analisis individu, data personel, dan catatan sesi (shared dan private) **peserta institusinya** (keputusan pemilik v2.9, menggantikan asumsi privasi lama). Setiap akses tercatat di audit log.
- Peserta hanya melihat slot dari coach dan kelas institusinya, sesuai levelnya.
- **QA tester** (v2.8) adalah penanda pada akun peserta (`users.qaTester`), bukan peran RBAC baru, agar seluruh alur peserta tetap berlaku. Diatur admin di halaman detail peserta (Make QA tester). Akun QA sebaiknya ditempatkan di institusi khusus uji. QA tester boleh melihat dan memulai tes berstatus Test mode, dan tidak terikat aturan placement, level, periode, atau batas percobaan.
- **Jadwal coaching ditentukan oleh coach.** Peserta tidak membuat jadwal, tidak mengatur jam coach, dan tidak mengirim booking waktu bebas; peserta hanya memilih slot yang telah diterbitkan coach dan masih tersedia.

## 5. Konfigurasi dan Level (Dapat Diubah Admin)

Semua angka di bawah **tidak ditulis mati di kode**. Disimpan di `levels` dan `config_params`, dikelola lewat halaman Parameter Sistem.

**levels** (angka adalah **placeholder**, ditetapkan pihak yang meminta)

| Level | Rentang skor ITP | Kuota coaching |
| --- | --- | --- |
| Basic | 310-459 | 12 |
| Intermediate | 460-559 | 8 |
| Advanced | 560-677 | 4 |

**config\_params** (nilai bawaan)

| Key | Nilai bawaan | Keterangan |
| --- | --- | --- |
| `score_conversion` | Hanya sumber awal profil bawaan "Default (linear estimate)"; konversi aktif kini dikelola di `scoring_profiles` | Estimasi linear berlabel **provisional**; tabel resmi wajib diverifikasi (dengan sumber) sebelum hasil berlabel **verified** |
| `weakness` | lemah < 60, prioritas tinggi < 40, minimum 5 butir | Ambang kelemahan per topik |
| `unit_pass_score` | 70 | Syarat lulus kuis unit (dari bank soal) |
| `level_up` | Estimasi skor simulasi terakhir ≥ batas bawah level berikutnya **dan** semua remedial prioritas tinggi selesai | Coach dapat merekomendasikan atau menahan |
| `booking` | Daftar maks 12 jam sebelum sesi, batal atau izin maks 24 jam sebelum sesi | Aturan penjadwalan |
| `quota_rules` | Hadir dan absen tanpa izin: terpakai. Izin tepat waktu: tidak terpakai. Coach batal: tidak terpakai | Aturan kuota |
| `stuck` | Waktu > 2× median soal (min 20 sampel) atau 3 salah beruntun di topik yang sama | Deteksi stuck |
| `idle_timeout_sec` | 60 | Waktu tidak aktif tidak dihitung |
| `plan_deadline_days` | Prioritas tinggi 7, sedang 14 | Deadline otomatis study plan |
| `counselor_quota` | 30 pesan per bulan (placeholder) | Batas Konselor AI |
| `maintenance` | `{on: false, message: ""}` | Mode pemeliharaan, diubah lewat saklar di dasbor admin (bagian 20.1), bukan halaman Parameter |
| `ui_comfort` | Jam tenang 21:00-07:00, maks 2 pengingat/hari, pengingat istirahat 45 menit, maks 3 item hari ini | Kenyamanan belajar (bagian 27.8) |

Override per institusi (`institutions.configOverrides`) disiapkan di skema tetapi **tidak dipakai di v2.0**.

### 5.1 Program Cycle dan Akses Periode

**Program Cycle** adalah periode resmi pembelajaran peserta pada suatu institusi. Tanggal dan durasinya tidak diasumsikan selalu 6 atau 12 bulan; admin mengonfigurasi periode berdasarkan kontrak atau kalender akademik/institusi yang berlaku. Setiap jadwal tes, milestone, study plan, coaching quota, dan aktivitas yang relevan harus dapat ditautkan ke `programCycleId`.

**Aturan bisnis yang disepakati untuk v2.6**

1. **Durasi periode:** mengikuti kontrak atau kalender institusi. Sumber durasi dan tanggal mulai/selesai disimpan pada `program_cycles`; sistem tidak mengunci satu durasi global.
2. **Jadwal ITP resmi:** dikonfigurasi untuk institusi dan periode terkait. Sistem tidak mengasumsikan tanggal ITP resmi yang sama untuk semua institusi. Status ITP resmi tetap opsional sesuai ruang lingkup program, kecuali institusi mengaktifkannya sebagai kewajiban.
3. **Diagnostik periode baru:** peserta wajib mengerjakan diagnostik awal/placement test kembali pada setiap periode baru. Hasil dan attempt periode lama tetap menjadi histori dan tidak ditimpa.
4. **Kuota coaching per periode:** kuota ditentukan dari kategori placement test pada periode itu: Basic = 12, Intermediate = 8, Advanced = 4 sesi (diputuskan ulang Oktober 2026, sebelumnya 8/6/4). Kuota dicatat per peserta dan `programCycleId`, dapat diubah admin di Parameter Sistem tanpa mengubah kode.
5. **Reset kuota:** saat periode baru dimulai dan placement test periode baru selesai, sistem menetapkan kuota baru secara penuh berdasarkan kategori terbaru. Sisa kuota periode sebelumnya hangus dan tidak dibawa ke periode baru; histori penggunaan lama tetap tersedia.
6. **Penutupan periode:** periode yang ditutup tidak menerima attempt baru atau booking coaching baru. Materi course periode lama tetap dapat dibaca, tetapi kuis/aktivitas yang dinilai dan aktivitas lain yang mengubah progres ditutup.
7. **Batas akses:** akses read-only setelah periode berakhir tidak memperpanjang enrollment. `enrollments.status` dan `enrollments.expiresAt` tetap menjadi sumber kebenaran; jika enrollment/kontrak berakhir, akses peserta berakhir sesuai aturan akses yang sudah ada.
8. **Histori:** attempt, analisis, study plan, progres course, booking, kehadiran, dan penggunaan kuota harus mempertahankan hubungan ke periode asal agar laporan historis tidak berubah saat periode baru dimulai.
9. **OCE/PURE dan diagnostik:** hubungan proses impor hasil OCE/PURE dengan placement/diagnostik awal perlu dikonfirmasi oleh pemilik proses. Sampai dikonfirmasi, keduanya tidak boleh diasumsikan sebagai satu jenis tes atau saling menggantikan.

**Status implementasi (Oktober 2026)**

- `program_cycles` per institusi: nama, `startsAt`, `endsAt`, `durationSource`, `closedAt`, `itpDate`, `itpRequired`. Status diturunkan dari tanggal dan `closedAt`; periode satu institusi tidak boleh beririsan; penutupan manual membebaskan sisa tanggalnya.
- Institusi tanpa periode memakai perilaku lama (tanpa batas periode). Periode pertama yang langsung aktif mengadopsi placement dan kuota yang sudah ada; periode berikutnya selalu mewajibkan placement baru.
- `users.placementCycleId` menandai periode tempat placement terakhir diambil; `programCycleId` tersimpan pada attempt, `coaching_quotas`, dan booking. Periode tanpa data peserta dapat dihapus; selebihnya hanya ditutup.
- Sesi ITP resmi dapat ditautkan ke periode; hanya peserta institusi periode itu yang melihat dan mendaftar.
- Butir 9 diputuskan (Oktober 2026): hasil OCE/PURE diunggah admin (CSV/Excel atau PDF per orang) dan dicocokkan ke peserta lewat email atau nama. Setelah dikonfirmasi, padanan TOEFL ITP-nya menetapkan level, kuota coaching periode berjalan, dan kelas; peserta tidak wajib placement di aplikasi lagi untuk periode itu (`users.placementSource` = `pure`/`oce`). Placement di aplikasi tetap dipakai bila peserta belum punya hasil OCE/PURE.
- Kelompok kemampuan: Basic 310-459, Intermediate 460-559, Advanced 560-677 (skala TOEFL ITP). Kelas (`class_groups`) berada di bawah level, berkapasitas dan ber-coach; peserta ditempatkan acak ke kelas berkursi yang paling longgar, sisanya masuk antrean menunggu kelas; admin dapat memindahkan peserta (riwayat di `class_members`).
- Padanan skor: TOEFL ITP ke CEFR memakai batas ETS (A2 337, B1 460, B2 543, C1 627); skala OCE/PURE diisi admin (batas minimal tiap tingkat CEFR, interpolasi linear di antaranya) dan ditampilkan di analisis hasil bersama penjelasan level.

**Aturan akses ringkas**

| Status periode | Materi course lama | Kuis/aktivitas dinilai | Tes baru | Booking coaching baru |
| --- | --- | --- | --- | --- |
| `scheduled` | Belum terbuka, kecuali akses pratinjau yang dikonfigurasi | Tidak | Tidak | Tidak |
| `active` | Baca sesuai akses peserta | Diizinkan sesuai jadwal/aturan | Diizinkan sesuai konfigurasi | Diizinkan sesuai kuota dan slot |
| `closed` | Read-only selama enrollment masih berlaku | Ditutup | Tidak untuk periode lama | Tidak untuk periode lama |

### 5.2 Hasil OCE/PURE, Kelompok, dan Kelas

**Alur**

1. Admin (atau `academic_admin`) mengunggah hasil OCE/PURE di menu **PURE / OCE Results**: Excel/CSV (kolom wajib `name`, `score`; opsional `email`, `date`, `test`) atau PDF satu per orang (nama dibaca dari isi PDF atau nama berkas, skor dari teks bila terbaca). PDF asli disimpan di GridFS bucket `pdf`.
2. Sistem mencocokkan tiap hasil ke peserta: email sama atau nama sama persis = pasti; urutan kata terbalik = pasti (0.95); salah ketik kecil = perlu dicek; selain itu tidak dicocokkan. Admin dapat memilih peserta lain, mengoreksi skor, melewati, atau menghapus baris sebelum dikonfirmasi.
3. Konfirmasi menetapkan level dari padanan TOEFL ITP, membuat kuota coaching periode berjalan, menandai placement periode itu sudah ada (`users.placementSource` = `pure`/`oce`), lalu menempatkan peserta ke kelas. Placement di aplikasi tetap dipakai bila peserta belum punya hasil OCE/PURE.
4. **Kelas** (`class_groups`) berada di bawah satu level, punya kapasitas, coach, dan opsional institusi serta periode. Peserta ditempatkan acak ke kelas yang masih ada kursinya, diutamakan yang paling longgar relatif terhadap kapasitas agar seimbang. Bila semua penuh, peserta masuk antrean **menunggu kelas** dan dapat ditempatkan sekaligus setelah kelas atau kursi ditambah.
5. Admin dapat memindahkan atau mengeluarkan peserta; riwayat keanggotaan tersimpan (`class_members.active=false`) dan tercatat di audit log. Kelas berisi siswa tidak dapat dihapus; kelas yang punya riwayat dinonaktifkan.
6. **Pemantauan per kelas**: jumlah siswa terhadap kapasitas, siswa **aktif** (masuk atau belajar dalam 7 hari terakhir), rata-rata skor, coach, dan daftar siswa dengan filter aktif atau tidak aktif.

**Padanan skor**

- TOEFL ITP ke CEFR memakai batas yang diterbitkan ETS: A2 dari 337, B1 dari 460, B2 dari 543, C1 dari 627.
- Skala OCE dan PURE diatur admin (`settings.score_equivalence`): memakai skala TOEFL ITP, atau rentang sendiri dengan skor minimal tiap tingkat CEFR; skor di antaranya dikonversi linear. Angka diisi dari penyedia tes, bukan perkiraan. Hasil yang sudah dikonfirmasi tidak dihitung ulang saat tabel berubah.
- Analisis hasil peserta menampilkan padanan TOEFL ITP, CEFR, OCE, dan PURE beserta penjelasan level.

| Level | Rentang ITP | Penjelasan untuk peserta |
| --- | --- | --- |
| Basic | 310-459 | Kosakata umum sehari-hari dan kalimat pendek; percakapan cepat dan bacaan panjang masih sulit |
| Intermediate | 460-559 | Tata bahasa cukup kompleks, ide utama percakapan akademis, artikel populer; 500-550 sering menjadi syarat kelulusan atau kerja |
| Advanced | 560-677 | Struktur kompleks, percakapan akademis cepat dan panjang, bacaan ilmiah berkosakata tinggi |

## 6. Model Data MongoDB

Semua koleksi punya `_id`, `createdAt`, `updatedAt`. Koleksi bertanda (inst) menyimpan `institutionId` dan di-index `{institutionId, ...}`.

```
# Akun dan mitra
users          { email(unique), givenName, surname, phone, role, institutionId, status:'invited'|'active'|'disabled',
                 currentLevelId, currentScoreEst, placementAttemptId, placementCycleId?, placementSource?:'app'|'pure'|'oce',
                 consentAt, lastLoginAt, passwordHash?(select:false), selfRegistered?,
                 resetTokenHash?(select:false), resetExpiresAt?,
                 goal?:'graduation'|'scholarship'|'career'|'other', education?, targetScore? }
otps           { email, codeHash, expiresAt(TTL), attempts }
institutions   { name, code(unique), seats, contractStart, contractEnd, contactEmail, status, configOverrides? }
enrollments    { userId, institutionId, status, startsAt, expiresAt }          # sumber kebenaran akses
program_cycles (inst) { name, code, startsAt, endsAt, durationSource:'contract'|'institution_calendar', status:'draft'|'scheduled'|'active'|'closed', timezone, createdBy, updatedBy }
program_milestones (inst) { programCycleId, type:'initial_diagnostic'|'course'|'coaching'|'progress_test'|'itp_simulation'|'official_itp'|'final_assessment', title, startsAt?, endsAt?, dueAt?, required, configuration?, status }
invitations    { email, institutionId, tokenHash, expiresAt(TTL), invitedBy, status }

# Konfigurasi
levels         { key, name, order, scoreMin, scoreMax, coachingQuota }
config_params  { key(unique), value, updatedBy }        # termasuk key 'maintenance' {on, message, since}
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
unit_progress (inst) { userId, unitId, programCycleId?, status, bestScore, attempts, timeSpentSec, completedAt }

# Analitik
learning_events (inst) { userId, type, refType, refId, topic, correct, timeMs, attemptNo, meta, at }
topic_stats (inst)     { userId, topic, answered, correct, score(akumulatif), avgTimeMs, lastAt }
analyses (inst)        { userId, trigger, sourceType, sourceId, summary, strengths[], weaknesses[], gapToNextLevel,
                         nextSteps[], narrative, engine, status }
study_plans (inst)     { userId, programCycleId?, version, items:[{topic, unitId, target:{type,value}, dueAt,
                         status:'todo'|'doing'|'done'|'late', source:'auto'|'coach', doneAt}] }
pdf_imports (inst)     { uploaderId, userId?, fileAssetId, extracted, verified, status, analysisId? }
counselor_threads (inst){ userId, messages:[{role, content, at}], reviewed, flag }

# Coaching
coach_slots (inst)     { coachId, classId?, levelId?, programCycleId?, startsAt, endsAt, capacity, booked, mode:'online'|'offline',
                         meetingUrl?, room?, status:'draft'|'published'|'cancelled', createdBy, updatedBy?, publishedAt? }
bookings (inst)        { slotId, userId, programCycleId?, status:'booked'|'present'|'absent'|'excused'|'cancelled', cancelledBy?:'participant'|'coach', cancelledAt? }
coaching_quotas (inst) { userId, levelId, programCycleId, placementAttemptId, placementCategory:'basic'|'intermediate'|'advanced', total, used, resetAt? }
session_notes (inst)   { bookingId, coachId, userId, note, focusTopics[], visibleToParticipant }

# Pendukung
assets   { ownerId, name?, mime, size, width, height, dataBase64, sha256(unique sparse), sensitive }
mail_queue { to, template, data, status, tries, nextTryAt }
notifications { userId, type, payload, readAt }
audit_logs { actorId, action, target, meta, at }
program_cycles { institutionId, name, startsAt, endsAt, durationSource, closedAt?, itpDate?, itpRequired }
course_modules { courseId, title, description, order, active }
class_groups   { name, levelId, institutionId?, programCycleId?, capacity, coachId?, active }
class_members  { classId, userId, method:'auto'|'manual', assignedBy, active, leftAt? }   (satu keanggotaan aktif per peserta)
external_results { batchId, source:'pure'|'oce', rawName, rawEmail?, score, itpScore, testDate?, fileName?, fileId?, userId?, matchConfidence, candidates[], status:'pending'|'confirmed'|'skipped', confirmedBy, confirmedAt, programCycleId? }
settings.score_equivalence { oce, pure: { name, sameAsItp, min, max, anchors{A2,B1,B2,C1} } }
scoring_profiles { name(unique), description, version, mode(linear|table), scaledMin, scaledMax, tables{listening,structure,reading: raw→scaled}, verified, source, verifiedBy, verifiedAt, isDefault, status(active|archived) }
```

**Aturan sistem**

- Akses selalu dicek dari `enrollments` (status dan `expiresAt`), bukan dari asumsi lain. Kerja sama berakhir → enrollment ikut berakhir. Status `program_cycles` membatasi aktivitas per periode, tetapi tidak boleh memperpanjang enrollment. Periode `closed` memberi akses baca materi lama saja (selama enrollment masih berlaku); kuis/aktivitas dinilai, attempt baru, dan booking baru pada periode itu ditutup.
- Skor estimasi dihitung **server-side** dari `scoring_profiles` (profil yang dipilih tes, atau profil default). Attempt menyimpan profil, versi, dan `scoreBasis`; profil yang sudah dipakai menilai attempt tidak dapat dihapus (hanya diarsipkan).
- Pembaruan `coaching_quotas.used` dan `coach_slots.booked` memakai **operasi atomik** (`$inc` dengan syarat), supaya dua peserta tidak merebut kursi terakhir.
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

Halaman masuk (`/sign-in`) punya dua tab: **Password** (bawaan) dan **Email code**. Keduanya menghasilkan sesi yang sama.

### 7.1 Captcha (v2.8)

- Login, daftar, dan lupa password mewajibkan captcha sah: **Cloudflare Turnstile** bila dikonfigurasi (`TURNSTILE_SITE_KEY`/`SECRET_KEY`), atau **captcha SVG bawaan** (server men-generate teks acak jadi gambar, token sekali pakai, kedaluwarsa 10 menit) sebagai fallback tanpa dependensi luar.
- Tab **Email code** di `/sign-in` tetap berfungsi **tanpa captcha** sebagai jalur bebas captcha bagi peserta yang kesulitan menyelesaikannya.
- Permintaan tanpa captcha sah (token kosong, salah, atau kedaluwarsa) ditolak 400 sebelum logika login/daftar/lupa password dijalankan.

**Alur OTP**

1. `POST /api/auth/request-otp` (tanpa captcha, lihat 7.1): **hanya email yang sudah terdaftar** (status `invited` atau `active` dan enrollment berlaku; admin tanpa enrollment) yang dikirimi kode. Respons **selalu sama** untuk email dikenal maupun tidak, supaya daftar peserta tidak bisa ditebak.
2. Kode 6 digit dari `crypto.randomInt`, disimpan sebagai hash, kedaluwarsa 5 menit. Satu kode aktif per email.
3. **Kode ditulis di judul email** (`123456 is your English Inspira sign-in code`). Tiap email berjudul unik sehingga Gmail tidak menumpuknya dalam satu thread; sebelumnya pengguna membaca kode lama dan mendapat "kode salah".
4. `POST /api/auth/verify-otp`: maksimal 5 percobaan, lalu terkunci. Sukses → cookie sesi `httpOnly; Secure; SameSite=Lax`, dan `emailVerifiedAt` terisi. Password yang diisi saat daftar tetapi belum diverifikasi dibuang (bisa jadi dibuat orang lain).
5. Rate limit: 3 permintaan OTP per email per 10 menit, 10 per IP per jam.
6. Admin pertama dibuat otomatis dari `ADMIN_EMAILS` saat login OTP pertama.

**Alur password**

1. `POST /api/auth/login {email, password, captchaToken, adminOnly?}`: bcrypt (cost 12). Pesan salah **selalu sama** ("Wrong email or password …") dan waktu respons disamakan dengan hash tiruan, sehingga keberadaan akun tidak bocor. `adminOnly: true` (dipakai `/admin/login`) menolak akun bukan admin.
2. Kebijakan: minimal 8 karakter, maksimal 128. Rate limit 30 per IP per 10 menit, 10 per email per 15 menit.
3. **Lupa password**: `POST /api/auth/forgot-password {email}` mengirim tautan `/reset-password?token=…` (token 32 byte, disimpan sebagai SHA-256, berlaku 30 menit, sekali pakai) hanya ke akun aktif. Respons selalu sama. `POST /api/auth/reset-password {token, password}` mengganti password dan membuktikan kepemilikan email.
4. **Ganti/set password**: `POST /api/me/password {current?, password}` dari Profil. Bila sudah punya password, password lama wajib benar. Akun undangan yang belum pernah punya password memakai OTP lalu set di Profil, atau lewat Lupa password.
5. **Ganti email**: `POST /api/me/email` dua langkah — kirim kode verifikasi ke email baru, lalu konfirmasi dengan kode untuk mengganti `email` dan menjaga sesi tetap valid.

**Antrean email.** Semua email lewat `mail_queue` dan worker cron, tidak boleh memblokir request. Percobaan ulang bertahap bila gagal.

> Gmail membatasi sekitar 500 email per hari untuk akun biasa. Impor satu angkatan dengan undangan massal bisa menghabiskannya, sehingga pengiriman undangan dijadwalkan bertahap (misal 100 per jam). Bungkus pengiriman di `sendMail()` agar bisa pindah ke SMTP lain tanpa mengubah kode lain.

**Template email** (semua berbahasa Inggris, font Poppins): OTP (kode di judul), verifikasi email pendaftaran (kode di judul), "akun sudah ada", reset password, undangan peserta, konfirmasi booking, pembatalan atau perubahan slot oleh coach, pengingat sesi (H-1), pengingat deadline study plan, peringatan kuota coaching hampir habis, hasil analisis siap.

## 8. Onboarding Peserta Lewat Institusi Mitra

Tidak ada pendaftaran terbuka tanpa institusi. Cara peserta masuk:

| Cara | Pelaku | Catatan |
| --- | --- | --- |
| Impor CSV atau Excel | `inst_admin`, `admin` | Kolom: email, nama, telepon (opsional). Validasi format dan duplikat, tolak bila melebihi `seats`, tampilkan laporan baris gagal |
| Undangan email | `inst_admin`, `admin` | Tautan berumur 7 hari. Login pertama melengkapi profil dan **persetujuan data (UU PDP)** |
| Input manual | `admin` | Kasus khusus |
| Tambah staf pusat (admin, academic admin, question editor) | `admin` | Menu Coaches & Admins. Akun dibuat aktif tanpa institusi dan **langsung dikirimi email undangan** (template `staff_invitation`) berisi tautan membuat password, berlaku 7 hari dan sekali pakai (`Invitation` tanpa `institutionId`). Untuk akun lama tersedia aksi Send reset link |
| **Daftar mandiri dengan kode institusi** | Peserta | `/register`. Wajib `institutions.code` yang aktif dan kursi tersisa (bagian 8.1) |

- Akun baru berstatus `invited`, menjadi `active` setelah login OTP pertama dan persetujuan data.
- Saat kontrak berakhir (`contractEnd`), enrollment kedaluwarsa dan login ditolak, data tetap tersimpan sesuai kebijakan retensi.
- Penonaktifan peserta tidak menghapus riwayat. Hak hapus data ditangani lewat prosedur admin yang tercatat di `audit_logs`.

### 8.1 Daftar mandiri dengan kode institusi (disederhanakan v2.8)

1. Peserta mengisi nama (`givenName`/`surname`), email, password, **kode institusi**, dan captcha (7.1) di `/register` → `POST /api/auth/register`.
2. Kode harus milik institusi `active` yang kontraknya belum berakhir dan masih punya kursi; bila tidak, ditolak dengan pesan jelas. Captcha tidak sah ditolak sebelum kode institusi dicek.
3. **Satu langkah** (disederhanakan dari verifikasi kode email dua langkah di v2.3): kursi diambil **atomik** (`$expr seatsUsed < seats`), akun dibuat `active` + `selfRegistered`, enrollment dan sesi dibuat langsung, lalu peserta diarahkan ke persetujuan data. Captcha menjadi pengaman utama pengganti verifikasi kode email.
4. Email yang **sudah punya akun aktif**: ditolak langsung (409) dengan pesan jelas, tanpa mengubah akun yang ada dan tanpa mengirim email.
5. Kode institusi tampil di dasbor `inst_admin` dan di daftar institusi admin, untuk dibagikan ke peserta.

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

**Level → Course → Modul → Unit (lesson) → (Materi + Kuis)**. Modul adalah pengelompok unit dan bersifat opsional. Course dapat memiliki gambar cover, prasyarat course lain (terbuka setelah semua unit prasyarat selesai, tanpa siklus), dan status arsip (hilang dari peserta, progres tetap tersimpan, dapat dipulihkan). Unit dapat diberi jeda drip `unlockAfterDays`: terbuka N hari setelah peserta memulai course; unit atau course yang terkunci menolak akses (403) dan tidak mencatat progres. Satu unit bisa berisi campuran materi Rich Text, materi HTML, audio, dan kuis dari bank soal. Peserta hanya melihat course sesuai levelnya. Unit lulus bila semua `requiredItems` selesai **dan** kuis bank soal mencapai `unit_pass_score`.

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

### 10.4 Alat konten (implementasi Oktober 2026)

- **Media Library** (`/admin/media`): semua gambar publik (soal, bacaan, materi, cover course, landing). Unggah banyak sekaligus (dikompres di browser), cari, ganti nama, salin URL. Pemakaian di soal, bacaan, materi, cover, dan pengaturan dideteksi; gambar yang masih dipakai tidak dapat dihapus. Foto pribadi peserta (sensitif) tidak pernah tampil di sini.
- **Impor soal dari Word (.docx)**: soal bernomor (`1.`), pilihan `A.`-`F.`, `Answer:`, `Explanation:` opsional; baris `Section:`, `Type:`, `Difficulty:`, `Tags:`, `Status:` berlaku untuk soal di bawahnya. Validasi sama dengan impor CSV/Excel, ada pratinjau tanpa menyimpan.
- **Impor soal dari Excel dengan kolom audio (v2.8)**: kolom opsional `audio` (judul entri di Audio Library) dan `instruction`. Baris dengan judul audio yang sama digabung satu `question_groups` yang menautkan ke audio itu (dibuat otomatis bila belum ada, dicocokkan by judul bila sudah ada); baris tanpa kolom audio tetap diimpor sebagai soal berdiri sendiri seperti sebelumnya.
- **Draf soal dengan AI**: Claude menulis draf soal Structure and Written Expression (1-10 per permintaan, maks 10 permintaan per 10 menit per akun). Tidak ada yang tersimpan sebelum admin memilih; yang dipilih disimpan berstatus `draft` dengan sumber "AI draft, needs review". Soal yang sama dengan bank soal ditandai duplikat. Listening dan Reading tetap ditulis manual karena butuh audio atau bacaan.
- **Course tiga tingkat**: Course > Modul > Unit (lesson) > Materi (sub-lesson), dengan cover, prasyarat, drip, dan arsip (bagian 10.1).

## 11. Mesin Tes dan Audio Listening

**Hasil tes, penahanan, dan ekspor PDF** (v2.8):
- **Tidak ada umpan balik di dalam tes.** Selama pengerjaan peserta tidak pernah menerima kunci jawaban, benar-salah, atau pembahasan (respons autosave hanya `{ok, savedAt}`). Pembahasan per soal dan transkrip audio baru dibuka di halaman hasil setelah tes selesai.
- **Penahanan hasil** (`tests.resultDelayMin`, `attempts.releaseAt`): bila diisi (mis. 120), hasil baru keluar sekian menit setelah peserta MULAI tes, supaya yang selesai lebih awal tidak membocorkan jawaban. Selama ditahan: `GET /api/attempts/:id/result` dan `/pdf` menjawab 423 dengan `availableAt`; skor disembunyikan dari daftar hasil, daftar tes, Home, perjalanan, ekspor data, dan konselor AI; email hasil, level, kuota, pipeline belajar, dan analisis AI tidak dijalankan (tertunda). Cron per menit (`releaseDueResults`) menjalankan efek itu sekali pada waktu rilis (klaim atomik lewat `releasedAt`). Placement baru tidak bisa dimulai lagi selama hasil placement sebelumnya ditahan. Admin dan QA tester dikecualikan.
- **Analisis diagnostic per placement:** untuk tes bertipe `placement`, masukan analisis AI (`buildEngineInput`) disusun hanya dari `topicScores` percobaan itu (butir, skor, status dihitung dari percobaan tersebut), tanpa label bagian dan label internal. Sejak pembaruan berikutnya semua jenis tes memakai percobaan itu sendiri (akumulatif `topic_stats` hanya cadangan bila percobaan tak punya rincian topik).
- **Laporan per percobaan** (`lib/attempt-result.ts`, dipakai halaman hasil dan PDF): ringkasan diagnostic (`lib/summary.ts`: keandalan dari persen soal terjawab dan lama pengerjaan, jarak ke level berikutnya, 3 prioritas dari soal yang bisa diselamatkan, rencana belajar), wawasan jawaban (`lib/insights.ts`: benar/salah/kosong, stamina per sepertiga section, kecepatan vs akurasi per jenis soal, perubahan jawaban, tebakan, waktu; bagian waktu disembunyikan bila data tidak cukup), dan analisis soal tidak dijawab (`lib/unanswered.ts`). Semua dihitung dari satu percobaan dengan aturan tetap, tanpa AI. Hanya agregat per section dan jenis soal: tidak ada hasil per nomor soal (peta urutan dan soal terlama sengaja dihapus agar bank soal tidak bocor), dan urutan stamina memakai urutan yang dilihat peserta (`seq`).
- **Tes terjadwal** (v2.8, `tests.scheduled`, `models/Schedule.ts`): satu tes punya beberapa sesi (`TestSession`: nama, buka, tutup, kuota); peserta memiliki paling banyak satu kursi per tes (`TestSeat`, unik per tes dan peserta). Bila `scheduled` menyala: peserta tanpa kursi tidak melihat tes itu; dengan kursi, tes hanya bisa dimulai di dalam jendela efektif (jendela sesi, atau perpanjangan per peserta). Pengerjaan yang sudah berjalan boleh selesai walau jendela tutup (dibatasi timer tes). Admin dan QA dikecualikan. Papan kartu admin (`/admin/tests/:id/schedule`): sebar otomatis (acak merata, seimbang per instansi, berurutan; sampel acak N orang; seed disimpan di audit log), geser atau pindahkan peserta antar kartu (kuota ditegakkan di server, peserta yang sudah mulai atau selesai tidak dipindah), kolom "belum dapat slot", kirim undangan lewat antrean email (dibatasi per jam dan per hari bersama undangan lain), jadwal ulang per peserta dengan alasan (audit log dan email), tiga pengingat otomatis per kursi yang sudah diundang dan belum mulai, masing-masing sekali: H-1 sebelum buka, saat sesi dibuka, dan 2 jam sebelum tutup (dicek tiap ±10 menit dan tiap jam). Logika di `lib/schedule.ts` (murni) dan `lib/schedule-admin.ts`. Peserta yang kursinya belum terbuka selalu melihat "Available on <tanggal>, <jam buka> to <jam tutup> WIB" di kartu My Tests, halaman persiapan, dan langkah Home. Tes berstatus Test mode hanya mengirim email undangan, jadwal ulang, dan pengingat ke akun QA tester. Menghapus tes membersihkan sesi dan kursinya.
- **Course mode preview** (v2.8, `courses.previewMode`): course yang sedang disiapkan. Peserta tidak melihatnya (daftar Learn, unit, kuis, progres) walau Active menyala, dan materi yang hanya dipakai course preview ikut disembunyikan dari perpustakaan materi dan tautan langsung (`previewOnlyMaterialIds`; materi yang juga dipakai course tayang tetap terlihat). Admin dan QA tester (`isPreviewer`) membuka Learn untuk semua level dengan label level, tanpa prasyarat dan drip, dan admin melihat materi berstatus draft; progres materi admin tidak disimpan, progres QA tester disimpan. Course lama tetap tayang (default mati); form course baru menyalakan Preview only. Course tetap dibagi per level (`courses.levelId`: Basic, Intermediate, Advanced).
- **Kerangka course baku dan ujian per bagian** (v2.8): tiap level (Basic/Beginner, Intermediate, Advanced) memakai kerangka tetap, satu course per bagian TOEFL ITP (`courses.part`: Listening Part A, B, C, Structure, Written Expression, Reading), masing-masing dengan modul tetap (modul pertama "Pengantar dan strategi") dan satu unit pembuka per modul. Admin membuatnya dengan "Create standard structure" per level (`lib/course-scaffold.ts`, `POST /api/admin/courses/scaffold`; aman diulang, bagian yang sudah ada dilewati; course baru Preview only). Daftar periksa di halaman Courses menandai yang masih kosong (materi, quiz unit, ujian per bagian). **Ujian per bagian** adalah jenis tes baru `section` (`tests.kind`), dipasang ke course lewat `courses.sectionTestId`, tidak tampil di My Tests, dan dimulai dari kartu di Learn lewat `POST /api/courses/:id/section-test` setelah semua unit course selesai (admin dan QA dikecualikan). Hasilnya (skor terbaik, lulus bila mencapai `unit_pass_score`, jumlah percobaan) disimpan di `course_progress`. `courses.requireSectionTest` (default mati) membuat course baru dianggap selesai untuk prasyarat hanya bila ujiannya lulus; bila mati, skornya hanya penanda kemajuan.
- **Kelanjutan diagnostic**: halaman hasil dan PDF memuat "Course progress by part" (unit selesai, rata-rata quiz unit, ujian per bagian; `lib/course-progress.ts`), dan masukan analisis AI membawa data yang sama sehingga narasi merujuk course yang sedang dijalani. Quiz unit dan ujian per bagian ikut masuk statistik topik (`topic_stats`) dan rencana belajar; quiz kecil berbobot sebanding jumlah soal sampai `weakness.minItems` agar tidak menggeser statistik terlalu kuat, ujian per bagian berbobot penuh.
- **Hasil quiz unit dan ujian per bagian** (`lib/attempt-kinds.ts`): dilaporkan sebagai **persen benar dan status lulus** (terhadap `unit_pass_score`), tanpa skor EPTA, level, CEFR, radar, atau selisih dengan tes sebelumnya, karena hanya mencakup sebagian materi. Keduanya tidak masuk tren skor EPTA (halaman hasil, daftar hasil, Home, Journey). Rincian per jenis soal, soal tidak dijawab, wawasan jawaban, kemajuan course, analisis, dan saran tetap ada. PDF mengikuti. PDF placement hanya memuat placement itu sendiri (`scopeForKind`): tanpa perbandingan dengan tes lain dan tanpa kemajuan course.
- **Statistik tes di diagnostic**: tabel per section dan total (soal, terjawab, tidak terjawab, benar, salah, % benar, skor skala) di halaman hasil dan PDF (`lib/summary.ts`).
- **Laporan hasil tanpa soal** (keputusan pemilik): halaman hasil dan PDF tidak menampilkan teks soal, opsi, kunci, penjelasan, atau transkrip audio (bagian "Answer review" dihapus; `GET /api/attempts/:id/result` tidak mengembalikan `review` maupun `transcripts`). Hanya agregat yang tampil: benar/salah/kosong per section, per jenis soal, statistik, dan analisis. Ada tes otomatis (`tests/result-no-leak.test.ts`) yang memastikan tidak ada teks soal di respons.
- **Rincian per jenis soal** (`lib/breakdown.ts`, dipakai halaman hasil dan PDF): dikelompokkan per section (skill `grammar` tampil sebagai Structure & WE), memuat semua jenis soal, terurut dari skor terendah (seri: soal terbanyak dulu), jenis dengan kurang dari 3 soal ditandai; label bagian (`part-a/b/c`) tampil terpisah sebagai "By part", dan label internal (`oce`, `test-NN`, `written-expression`) disaring juga untuk percobaan lama.
- **Padanan skor** di hasil peserta hanya TOEFL ITP dan CEFR, tanpa PURE/OCE.
- **Ekspor PDF**: `GET /api/attempts/:id/pdf` (skor, level, section, topik, analisis AI, rekomendasi course; tanpa pembahasan per soal) untuk pemilik atau admin. Data hasil disusun satu fungsi, `attemptResult` (`lib/attempt-result.ts`), dipakai bersama oleh halaman hasil dan PDF.
- **Sertifikat TOEFL resmi pihak ketiga**: admin melampirkan berkas (PDF/JPG/PNG, maks 10 MB, jenis ditentukan dari isi berkas) pada pendaftaran ITP setelah skor resmi dimasukkan (`POST/DELETE /api/admin/itp-registrations/:id/certificate`, disimpan di GridFS bucket `certfiles`). Peserta melihat (inline) dan mengunduh lewat `GET /api/certificates/:id/official[?download=1]`, hanya pemilik atau admin.

**Test mode** (v2.8, `tests.testMode`): tes yang sedang diuji. Hanya admin dan QA tester yang melihat dan bisa memulainya, walau Active menyala; peserta biasa tidak pernah melihatnya (daftar tes, mulai tes, kuis unit, dan langkah placement di Home). Tes baru di form admin dimulai dengan Active mati dan Test mode menyala; untuk menayangkan, matikan Test mode lalu nyalakan Active. Filter ada di `visibleTestFilter` (`lib/test-access.ts`).

**Acak soal** (`tests.shuffleQuestions`) mengacak urutan soal per peserta di dalam satu section; soal yang berbagi audio atau bacaan tetap satu blok. **Acak di dalam bagian** (`tests.shuffleWithinParts`, v2.8) mengacak hanya di dalam tiap bagian yang dibaca dari tag soal (`part-a`, `part-b`, `part-c`, `written-expression`; selain itu satu bagian bersama), sehingga urutan resmi Part A, B, C dan Structure sebelum Written Expression terjaga tetapi nomor soal berbeda antar peserta. Keduanya deterministik per percobaan (kunci: ID percobaan dan index section), tidak dipakai bersamaan (acak di dalam bagian diutamakan), dan tidak dapat diubah saat ada peserta sungguhan yang sedang mengerjakan. Satu fungsi, `orderQuestions` (`lib/shuffle.ts`), dipakai bersama oleh tampilan soal dan penegakan Secure mode.

**Jenis tes** (`tests.kind`): `placement` (sekali, format ITP penuh), `sim` (simulasi penuh berkala), `final` (Final Test, v2.8 — dinilai dan dilaporkan sama seperti `sim`, termasuk memicu evaluasi kenaikan level), `practice` (latihan per section atau topik, bebas ulang), `quiz` (penilaian unit, dinilai server).

- **Mulai tes**: server membuat `attempt` dan menetapkan `startedAt`. Timer **dipegang server**, klien hanya menampilkan.
- **Autosave** tiap perubahan (debounce 2 detik) ke `PATCH /api/attempts/:id`. Tangguh terhadap refresh dan koneksi putus, sisa waktu tidak berubah.
- **Pencatatan per soal**: `firstChoice`, `choice`, `changes` (berapa kali jawaban diganti), `timeSpentSec` (waktu idle dikurangi memakai `idle_timeout_sec`).
- **Submit atau waktu habis** → server menghitung skor raw → estimasi skala 310-677 per section dan total (profil konversi tes, `scoring_profiles`) → skor per topik dari tag soal → menulis `learning_events` dan memperbarui `topic_stats` → memicu analisis (bagian 13).
- **Proctoring ringan** untuk `placement` dan `sim`: catat `visibilitychange`, keluar fullscreen, paste, dan multi-tab sebagai `proctorFlags`. Admin meninjau di modul Review Proctoring.

### Audio listening (GridFS)

> Implementasi Oktober 2026: unggah `.mp3` (maks 15 MB) atau `.wav` (maks 30 MB, magic bytes `RIFF....WAVE`), durasi maks 10 menit; `audios` menyimpan `mime`, `peaks[]` (bentuk gelombang 0-100, dihitung di browser admin) dan `markers[{t, label}]` (maks 50 penanda waktu, misalnya awal tiap soal). Admin melihat gelombang suara, mengeklik untuk melompat, dan mengedit penanda. Nginx `client_max_body_size 32m`.

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
3. Server menghitung `scoreEst` lalu mencocokkan ke `levels` (rentang skor) → mengisi level untuk periode berjalan dan hasil diagnostik ditautkan ke `programCycleId`.
4. Sistem membuat `coaching_quotas` untuk peserta dan periode berjalan berdasarkan kategori placement test: Basic = 12, Intermediate = 8, Advanced = 4 (diputuskan ulang Oktober 2026, bagian 5). `total` ditentukan server-side dari konfigurasi kategori, bukan input frontend.
5. Analisis awal dan **study plan pertama** dibuat untuk periode berjalan (bagian 13 dan 15).
6. Email hasil dikirim, dashboard menampilkan level, kuota, rencana, dan jadwal terdekat.

**Pada periode baru:** peserta wajib menjalani diagnostik awal lagi. Hasil lama tidak ditimpa. Setelah kategori baru ditentukan, sistem membuat kuota penuh baru untuk `programCycleId` baru; sisa kuota periode lama tidak dibawa.

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

**Output** lewat **tool use** (`submit_analysis`, `input_schema` dibuat dari skema Zod dengan `z.toJSONSchema`), sehingga hasilnya objek terstruktur dan tidak bisa rusak karena tanda kutip di dalam teks. Hasil divalidasi Zod dan diulang maksimal 2 kali bila tidak valid atau terpotong `max_tokens` (3000). Catatan: `claude-sonnet-5-5` tidak menerima `tool_choice: tool`, jadi dipakai `tool_choice: auto` dengan perintah wajib memakai tool di system prompt.

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
- AI tidak menjanjikan skor dan hanya membahas persiapan ITP, **dalam bahasa Inggris** yang sederhana dan ramah.
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

- Setiap slot/booking coaching harus terhubung ke periode program yang sesuai. Booking baru hanya diizinkan jika periode berstatus `active`, enrollment masih berlaku, kuota periode tersebut tersedia, dan slot telah diterbitkan.
- Peserta hanya melihat slot yang telah diterbitkan dari kelas dan coach **institusinya**, untuk **levelnya**. Kalender peserta adalah kalender ketersediaan yang ditentukan coach, bukan alat untuk menyusun jadwal sendiri.
- Peserta hanya dapat memilih slot berstatus `open`, belum dimulai, belum penuh, dan masih dalam batas waktu (`booking`). Syarat kuota: `total − used − booking aktif > 0`; peserta juga tidak boleh memiliki booking lain yang waktunya beririsan.
- Booking/reschedule peserta hanya memilih slot yang sudah tersedia. Tidak ada endpoint atau UI peserta untuk membuat/mengubah `coach_slots`; permintaan perubahan jadwal, bila disediakan, berstatus permintaan dan menunggu keputusan coach, tanpa mengubah slot secara otomatis.
- Pemesanan kursi memakai operasi **atomik** agar tidak ada kursi ganda:

```ts
const slot = await CoachSlot.findOneAndUpdate(
  { _id, status: 'published', $expr: { $lt: ['$booked', '$capacity'] } },
  { $inc: { booked: 1 } }, { new: true });
if (!slot) throw new HttpError(409, 'The slot is full or no longer available');
```

### 16.3 Kehadiran dan kuota

| Kondisi | `bookings.status` | Kuota |
| --- | --- | --- |
| Peserta hadir | `present` | Terpakai |
| Absen tanpa izin | `absent` | Terpakai (hangus) |
| Izin sebelum batas 24 jam | `excused` | **Tidak** terpakai, boleh booking ulang |
| Izin lewat batas | `absent` | Terpakai |
| Coach membatalkan | `cancelled` (`cancelledBy: 'coach'`) | **Tidak** terpakai, peserta dapat jadwal ulang |

Pembaruan `coaching_quotas.used` bersifat **idempoten**: satu `bookingId` hanya dapat mengubah kuota satu kali. Kuota dihitung terpisah untuk setiap `programCycleId`; penutupan periode tidak menghapus catatan pemakaian. Pada periode baru, sistem membuat kuota baru berdasarkan placement test periode tersebut dan tidak membawa sisa periode lama.

### 16.4 Laporan pra-sesi dan catatan

- **Laporan pra-sesi** otomatis untuk coach: level dan skor estimasi, topik lemah, soal yang sering salah, bagian yang membuat stuck, status study plan dan kepatuhan, catatan sesi sebelumnya.
- **Catatan sesi**: coach menulis feedback dan topik fokus, dengan opsi tampil ke peserta. Coach juga dapat mengubah study plan dan memberi rekomendasi naik level.
- **Pantauan admin**: peserta yang kuotanya **tidak mungkin habis** sebelum `contractEnd` (misal slot Basic terlalu sedikit), kehadiran coach, dan kepatuhan peserta.

### 16.5 Penentuan jadwal coaching massal dari Excel (v2.8)

Pelengkap 16.1-16.2, bukan pengganti: coach tetap boleh menerbitkan slot satu per satu, dan admin dapat **memplot kelas + jadwal sekaligus** dari Excel/CSV untuk batch besar.

1. `GET /api/admin/coaching/import` mengunduh templat; `POST /api/admin/coaching/import` (admin, `?dry=1` untuk pratinjau tanpa menyimpan) menerima satu berkas. **Satu baris = satu peserta pada satu sesi.** Kolom: `coach` (email), `date` (YYYY-MM-DD), `time` (HH:MM), `duration` (menit, bawaan 60), `mode` (online/offline), `location` (link meeting atau ruangan), `capacity` (opsional; bawaan = jumlah peserta pada sesi itu), `level` (opsional), `title` (opsional), `participant` (email, wajib).
2. **Baris dengan coach + waktu mulai persis sama digabung jadi satu sesi** (satu `CoachSlot` baru, langsung berstatus `published`). Kapasitas = jumlah peserta unik pada sesi itu, atau nilai eksplisit bila lebih besar.
3. **Tiap peserta pada sesi dibooking lewat fungsi yang sama persis dengan booking mandiri** (`bookSlot`): kuota coaching, bentrok jadwal peserta, kapasitas sesi, dan level slot tetap dicek. Baris yang gagal (coach tidak ada, peserta tidak ada atau beda institusi, peserta dobel pada sesi yang sama, kuota habis, bentrok, sesi penuh, format tanggal/jam tidak sah) **dilaporkan per baris**; baris dan grup lain tetap diproses.
4. Sesi yang dibuat lewat jalur ini tunduk pada **cek bentrok jadwal coach** yang sama dengan pembuatan manual: tidak boleh beririsan dengan slot aktif coach itu yang sudah ada (termasuk sesama hasil impor).
5. Hasil respons: `{dry, slots, booked, failed:[{row, reason}]}`. Diimplementasikan di `lib/import-schedule.ts` (parser, murni) dan `app/api/admin/coaching/import/route.ts` (pencocokan coach/peserta, pembuatan sesi, booking).

## 17. Konselor AI

Hidup berdampingan dengan coach: AI untuk tanya jawab kapan saja, coach untuk sesi terjadwal. Keduanya membaca **satu sumber analisis yang sama**, sehingga saran tidak bertentangan.

- **Konteks**: profil, level, `analyses` terbaru, study plan, ringkasan attempt. Riwayat dipangkas ke N pesan terakhir plus ringkasan.
- **Guardrail**: hanya topik persiapan ITP, tidak menjanjikan skor, tidak mengubah study plan secara langsung (hanya mengusulkan, rencana resmi tetap oleh sistem atau coach), kuota pesan per bulan (`counselor_quota`).
- Admin dan coach dapat meninjau dan menandai jawaban buruk (`reviewed`, `flag`).
- Kunci API hanya di server, tidak pernah ke klien.
- Jawaban lewat tool use `send_reply` (`{reply, actionPlan[]}`), sama seperti analisis; tanpa kunci API dipakai jawaban berbasis aturan (`mock`).

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
Auth        GET /api/auth/captcha · POST /api/auth/request-otp · verify-otp · login · register · forgot-password · reset-password · logout
            GET /api/me (termasuk hasPassword) · POST /api/me/consent · /me/password · /me/email
Pemeliharaan GET /api/maintenance (publik) · GET/PUT /api/admin/maintenance (admin)
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
Admin coaching GET /api/admin/coaching/import (templat) · POST /api/admin/coaching/import (`?dry=1`, plotting massal, bagian 16.5)
Institusi   /api/inst/{summary,participants,invites,reports}
Kelas       GET/POST /api/admin/classes · PATCH/DELETE/GET(siswa) /api/admin/classes/:id · GET(menunggu)/POST /api/admin/classes/assign
Hasil luar  GET/POST /api/admin/external-results · PATCH/POST/DELETE/GET(PDF) /api/admin/external-results/:id · POST /api/admin/external-results/confirm-matched
            GET/PUT /api/admin/score-equivalence
Periode     GET/POST /api/admin/cycles · PATCH/POST(close|reopen)/DELETE /api/admin/cycles/:id
Konten      GET /api/admin/media · PATCH/DELETE /api/admin/media/:id · POST /api/admin/questions/generate · POST /api/admin/questions/import (.csv/.xlsx/.docx)
            POST/PATCH/DELETE /api/admin/modules[/:id]
```

Semua endpoint memakai `requireRole` dan `scopeByInstitution`. **Semua endpoint penulisan konten** (materi rich text dan HTML, lampiran, audio, bank soal, tes, course, unit, remedial map) **hanya untuk `admin`/`academic_admin`** (bank soal dan audio draft/review juga `content_editor`, bagian 4).

## 20. Keamanan

- Cookie `httpOnly; Secure; SameSite=Lax`, proteksi CSRF untuk mutasi. Zod untuk semua input, `mongo-sanitize` (cegah NoSQL injection), security headers (`helmet`).
- **Isolasi data antar mitra**: filter `institutionId` di level query pada setiap koleksi bertanda (inst), dengan **uji otomatis** bahwa `coach` dan `inst_admin` tidak dapat membaca institusi lain.
- **Materi HTML/JS** dianggap konten tidak tepercaya dan dijalankan hanya di iframe sandbox dengan origin opaque, CSP ketat, tanpa akses jaringan eksternal atau akses langsung ke origin aplikasi. Komunikasi melalui `postMessage` dengan nonce, validasi `event.source`, schema Zod, allowlist pesan, dan pembatasan frekuensi. Hanya `admin` pusat yang dapat menulis; wajib review, versioning, rollback, dan audit log. Tidak ada token atau secret di iframe. Uji keamanan wajib mencakup upaya akses parent DOM/storage/cookie, jaringan keluar, navigasi, popup, dan pemalsuan pesan.
- **UU PDP**: persetujuan data saat login pertama, tujuan dan retensi yang jelas, hak akses dan hapus, akses coach dan `inst_admin` ke data peserta dicatat di `audit_logs`.
- Data identitas (jika ITP resmi dipakai): enkripsi field (AES-256-GCM) untuk NIK, akses dibatasi dan dicatat.
- Secret hanya di environment, tidak di-commit. Backup MongoDB terjadwal (snapshot Atlas atau `mongodump` harian).
- Password: bcrypt cost 12, field hash `select:false`, pesan login seragam, token reset disimpan sebagai hash. Semua perubahan password dan pendaftaran tercatat di `audit_logs`.

### 20.1 Mode pemeliharaan

- **Saklar** on/off + pesan opsional di dasbor admin (`/admin`) → `PUT /api/admin/maintenance`. Disimpan di `config_params.maintenance`, tercatat di `audit_logs` (`maintenance.on/off`).
- **Saat aktif**, middleware memeriksa setiap request:
  - Sesi admin: semua tetap bisa diakses.
  - Halaman lain: ditampilkan `/maintenance` ("We are doing some maintenance." + pesan admin). `/admin/*` tanpa sesi admin diarahkan ke `/admin/login`.
  - API: `503 {maintenance: true}`.
  - Tetap terbuka: `/admin/login`, `/api/auth/{login,request-otp,verify-otp,logout}`, `/api/maintenance`, `/api/health`, `/api/cron/*` (job terjadwal tetap jalan), aset statis.
- **`/admin/login`**: halaman masuk khusus admin (password atau OTP, `adminOnly`), menolak akun bukan admin. `/admin` tanpa sesi juga diarahkan ke sini di luar masa pemeliharaan.
- Status dibaca middleware dari `GET /api/maintenance` dengan cache 10 detik di produksi dan batas waktu 2 detik; perubahan berlaku paling lambat 10 detik.
- **Wajib di server**: `INTERNAL_URL=http://127.0.0.1:<port>`. Tanpa ini middleware memanggil domain publik dari server sendiri, yang di VPS produksi butuh sekitar 7,6 detik sehingga cek gagal dan pemeliharaan tidak berlaku.
- **Halaman error**: bila chunk JS build lama hilang setelah deploy, halaman memuat ulang sendiri sekali.

## 21. Struktur Proyek

```
app/                                   # proyek Next.js (repo: opetganteng23/English-Inspira)
├─ app/
│  ├─ page.tsx                         landing (tamu) / alihkan ke dasbor (sudah masuk)
│  ├─ maintenance/                     halaman pemeliharaan
│  ├─ (public)/ sign-in, register, forgot-password, reset-password, consent, privacy, terms, verify/[number], admin/login
│  ├─ (participant)/ home, tests, tests/prepare/[id], results, learn, materials, coaching, counselor, itp,
│  │                 certificates, upload-result, profile, help
│  ├─ (room)/test-room/[id]
│  ├─ (coach)/coach/ schedule, sessions, participants/[id], counselor
│  ├─ (admin)/admin/ institutions, participants, users, question-bank, tests, courses, materials, ai-counselor,
│  │                 proctoring, coaching, itp-schedule, parameters, settings
│  ├─ (inst)/institution/ participants, schedule, reports, materials
│  └─ api/…                            (route handlers sesuai bagian 19)
├─ lib/ db, auth, password, otp-code, maintenance, mailer, mailq, mail-templates, rbac, scoring, ai, analysis,
│        analysis-engine, study-plan, scheduler, pdf, …
├─ models/ (Mongoose schema per koleksi)
├─ components/ Landing, OtpAuth (sign-in/register/forgot/reset), PasswordCard, MaintenanceToggle, ScheduleImportPanel, ImportPanel, RichEditor, ShellNav (tombol back otomatis di halaman turunan, v2.8), …
├─ middleware.ts                       RBAC kasar, CSRF, mode pemeliharaan
├─ instrumentation.ts                  menyalakan penjadwal node-cron (PM2)
├─ public/ fonts/ (Poppins woff2 + ttf, OFL), brand/ logo.png + logo-mark.png (bagian 26)
├─ scripts/ seed.ts, smoke.mjs, migrate-en.ts, seed-demo-participant.ts, align-quota-2026-10.ts, align-levels.ts
├─ deploy/ redeploy-english.sh, nginx.edulyfe.conf
└─ ecosystem.config.cjs · .env.example
```

### 21.1 Rute halaman

| Peran | URL | Pengganti URL lama |
| --- | --- | --- |
| Publik | `/`, `/sign-in`, `/register`, `/forgot-password`, `/reset-password`, `/consent`, `/privacy`, `/terms`, `/verify/:number`, `/admin/login`, `/maintenance` | `/masuk`, `/persetujuan`, `/privasi`, `/syarat`, `/verifikasi` |
| Peserta | `/home`, `/tests`, `/tests/prepare/:id`, `/test-room/:id`, `/results`, `/learn`, `/materials`, `/coaching`, `/counselor`, `/itp`, `/certificates`, `/upload-result`, `/profile`, `/help` | `/beranda`, `/tes`, `/tes/persiapan`, `/ruang-tes`, `/hasil`, `/belajar`, `/materi`, `/konselor`, `/sertifikat`, `/unggah-hasil`, `/profil`, `/bantuan` |
| Coach | `/coach`, `/coach/schedule`, `/coach/sessions`, `/coach/participants/:id`, `/coach/counselor` | `jadwal`, `sesi`, `peserta`, `konselor`, `materi` |
| Admin institusi | `/institution`, `/institution/participants`, `/institution/schedule`, `/institution/reports`, `/institution/materials` | `/institusi/…` |
| Admin | `/admin`, `/admin/institutions`, `/admin/participants`, `/admin/users`, `/admin/question-bank`, `/admin/tests`, `/admin/courses`, `/admin/materials`, `/admin/ai-counselor`, `/admin/proctoring`, `/admin/coaching`, `/admin/itp-schedule`, `/admin/parameters`, `/admin/settings` | `bank-soal`, `institusi`, `jadwal-itp`, `konselor-ai`, `kursus`, `materi`, `parameter`, `pengaturan`, `pengguna`, `peserta`, `tes` |

Semua URL lama dialihkan permanen (308) lewat `redirects()` di `next.config.mjs`, termasuk query string (mis. `/masuk?invite=…` → `/sign-in?invite=…`). Notifikasi lama di database yang menyimpan URL lama tetap jalan karena pengalihan ini. **Setiap halaman turunan** (bukan menu utama, mis. edit materi, detail peserta) menampilkan tombol **Back** otomatis di `ShellNav` (v2.8).

## 22. Build Instructions

**Prasyarat**: Node 20+, MongoDB Atlas, akun Gmail dengan App Password, API key Anthropic, modul pure-analytics (bentuk integrasi dikonfirmasi).

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
APP_URL=https://english.edulyfe.id      # dipakai di tautan email
ADMIN_EMAILS=admin@domain.com           # admin pertama dibuat saat login OTP pertama
MAIL_HOST=smtp.gmail.com  MAIL_PORT=465  MAIL_SECURE=true
MAIL_USER=...  MAIL_APP_PASSWORD=...  MAIL_FROM=...
ANTHROPIC_API_KEY=...  ANTHROPIC_MODEL=claude-sonnet-5-5  ANTHROPIC_MODEL_LIGHT=   # kosong = kuis kecil pakai template
CRON_SECRET=<acak>                      # untuk /api/cron/* dari cron sistem
ENABLE_INPROCESS_CRON=true              # penjadwal node-cron di dalam proses (PM2 satu instance)
INTERNAL_URL=http://127.0.0.1:4001      # WAJIB di server: cek mode pemeliharaan lewat localhost
FIELD_ENCRYPTION_KEY=<32 byte base64>
PURE_ANALYTICS_URL=...                  # bila berupa service

# 3. Jalankan lokal
npm run dev
npm run seed        # level, parameter bawaan, tes dan soal contoh (--demo: institusi/akun/jadwal/materi contoh)
npx tsx --env-file=.env.local scripts/seed-demo-participant.ts <email> --password <pw> [--reset]
                    # akun demo peserta: placement + 2 simulasi lewat mesin asli, analisis, study plan, Konselor AI; email tidak dikirim
npx tsx --env-file=.env.local scripts/migrate-en.ts   # sekali jalan: teks data contoh lama ke bahasa Inggris
node scripts/smoke.mjs   # uji asap end-to-end (dev server :3100, DB in-memory); saat ini 314 pemeriksaan
```

**Deploy (produksi)**: VPS Biznet Gio, **PM2 + Nginx + HTTPS, tanpa Docker**.

- Aplikasi di `/var/www/edulyfe-epta/app`, PM2 `edulyfe-epta` (`next start -p 4001`, satu instance fork, `ENABLE_INPROCESS_CRON=true`), Nginx meneruskan `english.edulyfe.id` ke port 4001. Env di `app/.env.local` (chmod 600).
- `redeploy-english` (`deploy/redeploy-english.sh`, disalin ke `/usr/local/bin`):
  1. `flock` agar tidak jalan ganda; `git fetch` + `merge --ff-only`.
  2. `npm ci` dan `next build` (memori dibatasi `--max-old-space-size=1536`, `nice -n 10`) hanya bila ada perubahan atau `FORCE=1`.
  3. `pm2 restart`, lalu cek kesehatan `/api/health`.
- Satu siklus deploy sekitar 3-5 menit, kebanyakan untuk build.
- Status 11 Oktober 2026: terpasang versi `5264fb9`; level disamakan dengan `scripts/align-levels.ts --yes`; Nginx `client_max_body_size 32m`; backup DB sebelum deploy di `~/backup-english-<tanggal>` (`mongodump`, URI dibaca dengan `@next/env` karena `.env.local` tidak dapat di-`source` oleh bash).
- Skrip operasional (jalankan dari `app/`, `MONGODB_URI` di env): `align-levels.ts` (rentang dan kuota level; hanya mengubah nilai bawaan lama), `reset-participants.ts` (hapus semua peserta beserta datanya; admin, staf, konten, dan audit log tetap; default hanya menampilkan, `--yes` untuk menghapus).
- Instance tunggal disengaja: rate limiter dan penjadwal ada di memori proses. Untuk scale-out: `ENABLE_INPROCESS_CRON=false`, jadwalkan `/api/cron/*` lewat cron sistem, pindahkan rate limiter ke penyimpanan bersama.

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
- Login, daftar, dan lupa password menolak permintaan tanpa captcha sah; captcha bawaan sekali pakai dan kedaluwarsa 10 menit. Tab Email code tetap berfungsi tanpa captcha.
- Impor yang melebihi `seats` ditolak dan baris gagal dilaporkan.
- Refresh saat tes tidak mengubah sisa waktu dan tidak menghilangkan jawaban.
- Placement test menghasilkan kategori sesuai konfigurasi `levels`, dan kuota coaching per periode terbentuk otomatis: Basic = 12, Intermediate = 8, Advanced = 4 (dapat diubah admin).
- Mengubah rentang level di Parameter Sistem langsung memengaruhi placement berikutnya tanpa mengubah kode.
- Admin dapat membuat periode dengan tanggal berdasarkan kontrak atau kalender institusi; durasi tidak di-hardcode menjadi 6 atau 12 bulan.
- Jadwal ITP resmi dapat dikonfigurasi per institusi dan periode; sistem tidak menerapkan satu jadwal global secara otomatis.
- Setiap peserta wajib menyelesaikan diagnostik awal pada periode baru sebelum kuota coaching dan study plan periode baru ditetapkan.
- Setiap hasil tes, study plan, progres, slot/booking coaching, dan kuota yang relevan ditautkan ke periode asal; data periode lama tidak ditimpa saat periode baru dimulai.
- Kuota per periode mengikuti kategori placement test: Basic 12, Intermediate 8, Advanced 4.
- Kuota periode baru ditetapkan penuh berdasarkan kategori placement test terbaru; sisa kuota periode lama tidak dibawa ke periode baru. Histori kuota dan sesi lama tetap dapat dilaporkan.
- Setelah periode ditutup, materi course lama bersifat read-only, sementara kuis dan aktivitas yang dinilai tidak dapat dikerjakan.
- Periode tertutup tidak menerima attempt tes baru atau booking coaching baru; aturan ini tidak memperpanjang akses melewati `enrollments.expiresAt`.
- Peserta tidak dapat booking coaching jika periode tidak aktif, enrollment berakhir, atau kuota periode tersebut habis.
- Hasil dan analisis muncul setelah **setiap** placement, kuis, unit, dan simulasi. Skor tampil langsung, narasi menyusul.
- Satu pengerjaan kecil tidak langsung menandai topik sebagai lemah (minimum sampel berlaku).
- Study plan diperbarui otomatis: topik membaik dicabut, kelemahan baru ditambah, item buatan coach tidak ditimpa.
- Dua peserta yang mem-booking kursi terakhir bersamaan: hanya satu berhasil. Coach tidak bisa membuat dua slot bentrok.
- Impor jadwal Excel: baris coach + waktu sama digabung satu sesi; tiap peserta tunduk pada kuota/bentrok/kapasitas yang sama dengan booking mandiri; baris gagal dilaporkan per baris tanpa menggagalkan baris lain; sesi hasil impor tidak bisa bentrok dengan sesi lain milik coach yang sama.
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
- Daftar dengan kode institusi salah ditolak; password < 8 karakter ditolak; kursi penuh menolak daftar (kursi dikembalikan bila langkah berikutnya gagal); daftar ulang dengan email yang sudah aktif ditolak (409) tanpa mengubah akun yang ada.
- Login password salah memberi pesan yang sama dengan email tak terdaftar. Tautan reset hanya berlaku sekali dan 30 menit; password lama tidak berlaku setelah reset.
- Mode pemeliharaan aktif: pengunjung dan peserta melihat halaman pemeliharaan, API non-admin 503, `/admin` tanpa sesi diarahkan ke `/admin/login`, admin tetap bisa semua, cron tetap jalan. Setelah dimatikan semua kembali normal.
- Semua teks yang dilihat pengguna berbahasa Inggris; URL lama berbahasa Indonesia dialihkan 308 ke URL baru beserta query string.
- Analisis Claude tidak jatuh ke template karena JSON rusak (keluaran lewat tool use).
- Setiap halaman admin/coach/institusi/peserta yang bukan menu utama menampilkan tombol Back yang berfungsi.
- Kategori tes Final Test dinilai dan dilaporkan sama seperti Simulation, termasuk memicu evaluasi naik level.
- Tes berstatus Test mode tidak muncul dan tidak bisa dimulai oleh peserta biasa, walau Active; admin dan QA tester bisa melihat dan memulainya, dan QA tester bisa mengulang placement tanpa izin.

## 25. Asumsi dan Keputusan yang Masih Terbuka

| # | Hal | Asumsi di MTS v2 | Perlu konfirmasi |
| --- | --- | --- | --- |
| 1 | Angka `levels` (Basic, Intermediate, Advanced) | 310-459, 460-559, 560-677 | **Diputuskan** (Oktober 2026) |
| 2 | Tabel konversi raw → 310-677 | Disimpan sebagai konfigurasi | **Verifikasi ke sumber resmi** |
| 3 | Siapa yang mengimpor peserta | `inst_admin` dan `admin` | Pihak yang meminta |
| 4 | Parameter per mitra | Sama untuk semua (override disiapkan, tidak dipakai) | Mitra |
| 5 | Yang dilihat `inst_admin` | Statistik agregat dan daftar peserta, **tanpa** isi analisis individu dan catatan sesi | Mitra dan persetujuan data peserta |
| 6 | Kuota coaching per kategori placement test dan per periode | Basic 12, Intermediate 8, Advanced 4 (diputuskan ulang v2.8, sebelumnya 8/6/4); kuota baru penuh setiap periode, sisa lama hangus | Diputuskan untuk v2.6/v2.8 |
| 7 | Apakah kuota berubah jika peserta naik level di tengah periode | Tidak otomatis diubah oleh keputusan v2.6; aturan khusus kenaikan level perlu dipastikan agar tidak bertentangan dengan kuota yang ditetapkan oleh placement test | Pihak yang meminta |
| 8 | Bentuk pure-analytics (library atau service) dan format input | Adapter bagian 14 | Tim pengembang |
| 9 | Siapa yang boleh mengunggah PDF | Peserta (miliknya), coach, admin | Pihak yang meminta |
| 10 | Retensi data dan file PDF, retensi data setelah kontrak berakhir | Belum ditetapkan | Mitra dan hukum |
| 11 | Kuota Konselor AI | 30 pesan per bulan (placeholder) | Pihak yang meminta |
| 12 | ITP resmi dan sertifikat | Opsional, Fase 9 | Pihak yang meminta |
| 13 | Aturan batas booking dan batal | 12 jam dan 24 jam | Pihak yang meminta |
| 14 | Skala resmi OCE dan PURE | Dianggap sama dengan skala TOEFL ITP sampai diisi admin | Penyedia tes |
| 15 | Retensi PDF hasil OCE/PURE | Disimpan sampai barisnya dihapus admin | Mitra dan hukum |
| 14 | Kebijakan permintaan reschedule oleh peserta | Peserta memilih slot coach lain yang tersedia; permintaan waktu bebas tidak mengubah jadwal otomatis | Pihak yang meminta |
| 14 | Penulis materi HTML | Hanya `admin` pusat; materi dijalankan dalam iframe sandbox terisolasi | Tim keamanan/pengembang |
| 15 | Nama produk di UI | **Diputuskan v2.3: English Inspira** (domain, DB, nama PM2 tetap `edulyfe`) | Selesai |
| 16 | Pendaftaran mandiri | **Diputuskan v2.3: boleh, wajib kode institusi.** Disederhanakan v2.8: satu langkah, tanpa verifikasi kode email, captcha sebagai pengamannya | Selesai |
| 17 | Password minimum admin | 8 karakter untuk semua akun lewat UI; akun admin produksi dibuat manual dan **sebaiknya diganti** ke password yang lebih panjang | Pemilik |
| 18 | Pembersihan pendaftar yang tidak memverifikasi email | Belum ada (tidak memakan kursi) | Pihak yang meminta |
| 19 | Login password untuk coach/admin institusi | Lewat Lupa password untuk membuat password pertama (Profil hanya untuk peserta) | Pihak yang meminta |
| 20 | Makna titik coaching “8, 6, 4” | Kuota sesi coaching berdasarkan kategori placement test: Basic 8, Intermediate 6, Advanced 4 | Diputuskan untuk v2.6 |
| 21 | Durasi Program Cycle | Mengikuti kontrak atau kalender institusi; bukan durasi tetap global | Diputuskan untuk v2.6 |
| 22 | Akses setelah Program Cycle ditutup | Materi lama read-only; kuis/aktivitas yang dinilai ditutup, selama enrollment masih berlaku | Diputuskan untuk v2.6 |
| 23 | Diagnostik periode baru | Wajib diulang; histori diagnostik sebelumnya dipertahankan | Diputuskan untuk v2.6 |
| 24 | Jadwal ITP resmi | Dikonfigurasi per institusi/periode; kewajiban ITP resmi tetap opsional kecuali program institusi menetapkannya | Konfigurasi disepakati; status wajib per program perlu dikonfirmasi |
| 25 | Hubungan OCE/PURE dengan placement/diagnostik | Tidak disatukan sebelum proses bisnis dikonfirmasi | Perlu konfirmasi pemilik proses |
| 26 | Akses unduh materi setelah periode ditutup | MTS v2.6 menetapkan read-only, tetapi tidak menetapkan apakah unduh file diperbolehkan | Perlu konfirmasi pihak yang meminta |
| 27 | Siklus peserta per angkatan atau individual | Periode institusi menjadi default; variasi cohort/gelombang per peserta perlu dikonfirmasi jika diperlukan | Perlu konfirmasi pihak yang meminta |
| 28 | Nama sesuai KTP + upload KTP saat pendaftaran akun (bukan hanya saat daftar ITP resmi) | Belum diterapkan; upload KTP baru ada di alur pendaftaran ITP resmi | **Pemilik: wajib untuk semua peserta, atau cukup untuk ITP resmi?** |
| 29 | Mekanisme pendaftaran "OSEE" (mandiri dashboard atau batch Excel) | Istilah belum dikenali di spesifikasi maupun kode | **Pemilik: jelaskan maksud OSEE** |
| 30 | Dashboard analitik manajemen institusi (placement, progres, hasil akhir lintas peserta) | Belum ada sebagai modul terpisah; data mentahnya sudah tersedia lewat laporan institusi dan `external_results`/`class_groups` | **Menunggu konsep Pak Yudha dan Pak Azwar** |
| 31 | Kenyamanan belajar dan psikologi UI (bagian 27) | Sempat dirancang (bagian 27) | **Dibatalkan oleh pemilik**, tidak diterapkan. Tetap sebagai referensi desain untuk pengerjaan berikutnya |

## 26. Bahasa, Halaman Publik, dan Merek

> **Penamaan tes (v2.8, Oktober 2026):** pada semua teks yang terlihat pengguna (peserta, admin, email, PDF, prompt AI, halaman publik) tes ini bernama **EPTA (English Proficiency Test & Analytics)**; tidak ada lagi embel-embel "TOEFL ITP". Bagian lain dokumen ini yang masih menyebut TOEFL ITP menjelaskan acuan format dan riwayat, bukan teks tampilan. Nama internal (rute `/itp`, koleksi `itp*`, tipe sertifikat `itp`) tidak diubah. Nomor sertifikat resmi baru berawalan `EPTA-OFC-`; nomor lama `EPTA-ITP-` tetap valid untuk verifikasi.

- **Bahasa**: semua teks yang dilihat pengguna dalam bahasa Inggris, termasuk pesan error API, email, PDF (sertifikat/laporan), prompt dan jawaban AI, preset materi, kolom ekspor Excel, dan contoh templat impor. Format tanggal `en-GB`. Tanpa tanda panah (diganti teks seperti Previous/Next) dan tanpa em dash di teks tampilan.
- **Tetap diterima tetapi tidak tampil**: alias kolom impor berbahasa Indonesia (agar file Excel lama tetap bisa diimpor) dan kode enum internal (`sma/d3/s1/s2`, `L/P`; labelnya tampil dalam bahasa Inggris).
- **Merek**: "ENGLISH INSPIRA" + "by Inspira Teknologi". Logo tunggal **`public/brand/logo.png`** (lambang + nama + tagline sudah menyatu dalam gambar; opsi desain ketiga dari pemilik, Oktober 2026), dibungkus kartu putih di atas latar gelap agar tetap terbaca; `logo-mark.png` (lambang saja) untuk favicon dan kop PDF. Font Poppins.

### 26.1 Landing page (`/`)

- Mengikuti desain *English Inspira — Redesign Website*:
  - Bagian: hero dengan contoh hasil dan percakapan konselor, mitra pengembang (Inspira Teknologi, Telkom University, CoE AILO), cara kerja 4 langkah, Konselor AI, English Intelligence Journey 7 tahap, untuk institusi, untuk siapa, FAQ, dan CTA akhir.
  - **Tanpa harga, keranjang, atau free trial.**
  - CTA: **Create account** (kode institusi), **Sign in**, dan **Contact us** untuk institusi (email/WhatsApp dari Pengaturan, cadangan inspiratekno.com).
- Klaim hanya fitur yang memang ada: tidak menyebut pengingat WhatsApp atau proctoring webcam. Proctoring hanya layar penuh dan perpindahan tab.
- Pengguna yang sudah masuk diarahkan ke dasbor perannya. Logout kembali ke landing page. Halaman masuk punya tautan "Back to home".

## 27. Kenyamanan Belajar dan Psikologi UI

> **Status implementasi (v2.8): referensi desain, belum/tidak diterapkan.** Dirancang bertahap lalu dibatalkan oleh pemilik (notulensi 11/10/2026); tampilan dikembalikan ke sebelum bagian ini. Seluruh isi bagian 27 (design token, `ui_comfort`, dsb.) adalah rencana desain, bukan perilaku aplikasi yang berjalan saat ini.

Belajar untuk TOEFL ITP adalah kegiatan yang panjang dan menekan: ada skor, ada level, ada deadline, ada tes berwaktu. Antarmuka tidak boleh menambah tekanan itu. Bagian ini menetapkan bagaimana setiap layar dirancang agar peserta merasa **tenang, mampu, dan tahu langkah berikutnya**. Semua aturan di sini bersifat tampilan dan bahasa; aturan skor, keamanan, RBAC, dan timer server **tidak berubah**.

### 27.1 Landasan teori

Setiap keputusan desain di bagian ini mengacu ke salah satu teori berikut. Bila ada usulan UI baru, tanyakan: teori mana yang mendukungnya, dan apakah ia melanggar salah satunya.

| Teori | Inti | Konsekuensi untuk UI English Inspira |
| --- | --- | --- |
| **Cognitive Load Theory** (Sweller) | Memori kerja terbatas. Beban yang tidak berhubungan dengan materi (*extraneous load*) mengurangi kapasitas untuk belajar | Satu tugas utama per layar, navigasi dan dekorasi minimal saat belajar dan tes, tanpa animasi yang bersaing dengan materi |
| **Self-Determination Theory** (Deci & Ryan) | Motivasi bertahan bila tiga kebutuhan terpenuhi: otonomi, kompetensi, keterhubungan | Peserta diberi pilihan (urutan item plan, mode tampilan), progres yang terlihat, dan rasa didampingi coach dan Konselor AI |
| **Attentional Control Theory** (Eysenck dkk.) dan riset kecemasan tes | Kecemasan menguras sumber daya perhatian sehingga kinerja turun, terutama pada tugas berat seperti Structure dan Reading | Ruang tes tanpa sinyal ancaman (merah berkedip, hitung mundur besar), bahasa yang menenangkan, latihan kondisi tes sebelum placement |
| **Feedback Intervention Theory** (Kluger & DeNisi) dan model umpan balik Hattie & Timperley | Umpan balik yang mengarah ke diri ("kamu lemah") cenderung menurunkan kinerja; umpan balik pada tugas dan proses ("topik ini butuh latihan, mulai dari unit ini") membantu | Hasil disajikan per topik dan langkah berikutnya, bukan label tentang orangnya |
| **Mindset dan atribusi** (Dweck; Weiner) | Keyakinan bahwa kemampuan bisa tumbuh, dan atribusi kegagalan ke faktor yang bisa diubah, menjaga usaha | Bahasa "belum" dan "butuh latihan", penyebab yang dapat diubah (strategi, waktu), bukan bakat |
| **Flow** (Csikszentmihalyi) | Fokus penuh muncul saat tantangan seimbang dengan kemampuan dan umpan balik jelas | Course sesuai level, kuis pendek, umpan balik segera setelah selesai |
| **Goal-setting** (Locke & Latham) dan **goal-gradient** (Hull; Kivetz dkk.) | Tujuan spesifik dan dekat lebih memotivasi; usaha naik saat tujuan terasa dekat | Study plan ditampilkan sebagai 1 sampai 3 tugas hari ini, progres menuju level berikutnya ditampilkan sebagai jarak yang menyempit |
| **Spacing dan retrieval practice** (Ebbinghaus; Roediger & Karpicke) | Latihan mengingat yang diberi jeda menghasilkan ingatan lebih awet dibanding membaca ulang | Pengingat ulasan topik setelah jeda, kuis singkat sebagai latihan, bukan hanya ujian |
| **Peak-end rule** (Kahneman) | Pengalaman diingat dari puncak dan akhirnya | Setiap sesi belajar dan tes ditutup dengan layar penutup yang hangat dan satu langkah jelas |
| **Hick's law** dan **progressive disclosure** | Waktu memutuskan naik dengan jumlah pilihan | Satu tombol aksi utama per layar, detail analisis disembunyikan di balik "See details" |
| **Calm Technology** (Weiser & Brown) | Teknologi yang baik memberi informasi di pinggir perhatian dan hanya memanggil ke tengah saat perlu | Notifikasi dibatasi, dikelompokkan, dan menghormati jam tenang |

> Catatan empiris: teknik seperti Pomodoro dan psikologi warna punya bukti yang lebih lemah dibanding teori di atas. Keduanya dipakai sebagai **pilihan yang dapat diatur peserta**, bukan klaim ilmiah di UI.

### 27.2 Prinsip desain (wajib di semua layar peserta)

1. **Satu hal pada satu waktu.** Setiap layar punya satu aksi utama yang jelas (tombol primer tunggal). Aksi lain tampil sebagai tombol sekunder atau tautan.
2. **Selalu ada langkah berikutnya.** Tidak ada layar buntu. Hasil, error, dan halaman kosong selalu menawarkan apa yang bisa dilakukan sekarang.
3. **Umpan balik pada tugas, bukan pada orang.** Tidak ada label seperti "weak student" atau "failed". Yang dinilai adalah topik dan pengerjaan.
4. **Tenang secara visual.** Warna lembut, ruang kosong yang lega, gerak minimal. Warna kuat hanya untuk aksi utama dan informasi yang benar-benar penting.
5. **Peserta memegang kendali.** Mode tampilan, ukuran teks, mode fokus, pengingat istirahat, dan jam tenang notifikasi dapat diatur di Profil.
6. **Prediktabel.** Posisi navigasi, tombol, dan pola interaksi sama di semua halaman. Tidak ada kejutan seperti modal yang muncul sendiri saat sedang membaca materi.
7. **Jujur tanpa menekan.** Data tetap akurat (skor, deadline, kuota). Yang diatur adalah cara penyajiannya, bukan isinya.

### 27.3 Design token tenang

Semua nilai disimpan sebagai CSS variable / token Tailwind, bukan ditulis langsung di komponen.

**Warna** (diambil dari logo English Inspira: navy ENGLISH, biru INSPIRA, emas pesawat kertas)

| Token | Terang | Gelap | Pemakaian |
| --- | --- | --- | --- |
| `--bg` | `#F5F8FD` (putih kebiruan, bukan putih murni) | `#0C1424` | Latar halaman, mengurangi silau saat belajar lama |
| `--surface` | `#FFFFFF` | `#131D31` | Kartu dan area konten |
| `--text` | `#14223B` | `#E6ECF7` | Teks utama (kontras ≥ 7:1 untuk bacaan panjang) |
| `--text-muted` | `#55627A` | `#9FB0CC` | Teks pendukung (kontras ≥ 4.5:1) |
| `--primary` | Navy-biru `#123B8C` | `#7FB2F5` | Aksi utama, tautan, pilihan terpilih |
| `--blue` | `#1E78D6` | `#5AA2F0` | Progres dan jalur menuju level berikutnya |
| `--gold` / `--attention` | Emas `#E0A526` (isian), `#8A5A00` (teks) | `#F0BE4A` / `#F0C766` | Butuh perhatian: topik prioritas, deadline dekat, penanda flag. Emas dipakai sebagai isian, bukan teks kecil |
| `--calm` | Teal `#1E7F6E` | `#5CC2A8` | Selesai, kuat |
| `--critical` | Merah redup `#B4483C` | `#E58478` | **Hanya** untuk error sistem dan tindakan yang tidak bisa dibatalkan |

Logo memakai PNG transparan. Pada mode gelap logo ditempatkan di atas chip putih agar warna navy ENGLISH tetap terbaca.

- **Merah tidak dipakai untuk jawaban salah, topik lemah, atau item plan terlambat.** Penanda salah memakai `--attention` + ikon dan teks, karena merah memicu respons ancaman pada konteks evaluasi.
- Status tidak boleh hanya dibedakan warna: selalu ada ikon dan teks (aksesibilitas buta warna).

**Tipografi** (Poppins saja, sesuai bagian 26; bobot 400, 500, dan 600, di-host lokal agar tidak bergantung pada CDN)

| Unsur | Ukuran | Line height | Catatan |
| --- | --- | --- | --- |
| Teks materi dan passage Reading | 18 px (dapat diubah 16-22 px) | 1.7 | Lebar baris maksimal 68 karakter (`max-width: 68ch`) |
| Teks UI | 16 px | 1.5 | Minimum 14 px untuk label sekunder |
| Stem soal | 18 px, weight 500 | 1.6 | Opsi jawaban 17 px, area klik ≥ 48 px tinggi |
| Judul halaman | 24-28 px, weight 600 | 1.3 | Satu H1 per halaman |

Poppins punya bentuk huruf lebar; untuk passage panjang, letter-spacing `0.005em` dan paragraf diberi jarak `1em`.

**Ruang dan bentuk**: skala jarak 4/8/12/16/24/32/48 px; radius kartu 12 px; bayangan sangat tipis; maksimal tiga tingkat hierarki visual per layar.

**Gerak**: durasi 150-250 ms, easing `ease-out`, hanya untuk transisi status (buka panel, centang selesai). Tanpa animasi berulang, parallax, atau konfeti otomatis. `prefers-reduced-motion` dihormati penuh, dan peserta dapat mematikan animasi di Profil.

### 27.4 Penerapan per layar

#### 27.4.1 Beranda peserta (`/home`)

Beranda menjawab tiga pertanyaan, dalam urutan ini: **Apa yang saya kerjakan hari ini? Seberapa jauh saya? Kapan sesi coaching berikutnya?**

1. **Kartu "Today"**: 1 sampai 3 item dari study plan (urut prioritas dan deadline), masing-masing dengan perkiraan durasi ("About 15 min"). Satu tombol primer **Continue** ke item pertama. Item lain dapat dipilih (otonomi).
2. **Kartu progres**: level saat ini dan jarak ke level berikutnya sebagai bilah yang menyempit ("38 points to Advanced"), ditambah jumlah topik yang membaik bulan ini. Tidak menampilkan peringkat atau perbandingan dengan peserta lain.
3. **Kartu coaching**: sesi terdekat atau ajakan memilih slot, dengan sisa kuota ditulis netral ("3 sessions left").
4. Sisanya (riwayat, semua analisis, Konselor AI) di bawah lipatan atau di menu.

Sapaan menyesuaikan waktu lokal ("Good morning, Dani"). Tidak ada banner promosi atau notifikasi bertumpuk di beranda.

#### 27.4.2 Placement test dan simulasi

Kecemasan tertinggi terjadi di sini. Tujuannya menurunkan ancaman tanpa mengubah kondisi tes.

**Sebelum mulai** (`/tests/prepare/:id`)
- Bingkai placement sebagai **titik awal, bukan ujian lulus/gagal**: "This test helps us find the right starting point for you. There is no pass or fail."
- Tampilkan struktur tes (tiga bagian, durasi, jumlah soal) dan aturan audio "plays once" **sebelum** mulai, agar tidak ada kejutan.
- Cek audio dan koneksi (sudah ada di bagian 11) dibuat sebagai daftar centang yang tenang, bukan peringatan.
- Tawarkan **latihan 3 soal contoh** dalam format ruang tes yang sama, tidak dinilai. Paparan terhadap format mengurangi ketidakpastian.
- Satu ajakan bernapas singkat yang dapat dilewati ("Take a slow breath. Ready when you are."). Tanpa teks panjang tentang kecemasan.

**Di ruang tes** (`/test-room/:id`)
- Mode fokus otomatis: header aplikasi, menu, notifikasi dalam aplikasi, dan Konselor AI disembunyikan.
- **Tampilan timer** (timer tetap dipegang server):
  - Bawaan: sisa waktu bagian ini dalam teks kecil di pojok (`18:42 left in Structure`).
  - Peserta dapat menyembunyikan timer dengan satu klik; timer muncul sendiri pada 5 menit dan 1 menit terakhir.
  - Tidak ada warna merah, kedipan, atau hitung mundur detik besar. Pada 5 menit terakhir teks berubah ke `--attention` dengan pesan tenang "5 minutes left. Keep going at your pace."
- Navigator soal menandai *answered*, *not yet answered*, dan *flagged for review* (peserta boleh menandai soal untuk ditinjau). Tidak ada penanda yang menghakimi.
- Autosave terlihat halus ("Saved") agar peserta tidak khawatir kehilangan jawaban. Bila koneksi putus: "You are offline. Your answers are safe and will sync when you are back." Waktu tetap berjalan sesuai aturan server, dan itu disampaikan dengan jujur.
- Peringatan proctoring kepada peserta (keluar layar penuh, pindah tab) ditulis sebagai pengingat, bukan tuduhan: "Please stay in this tab during the test." Detail flag hanya terlihat admin.
- Konfirmasi submit menyebut jumlah soal belum dijawab secara netral dan menawarkan kembali: "You have 3 unanswered questions. Review them or submit now."

**Setelah submit**
- Layar penutup segera: "Well done for finishing. Your results are being prepared." Ini titik akhir pengalaman (*peak-end*), jadi dibuat hangat dan singkat.

#### 27.4.3 Penyajian hasil dan analisis (`/results`)

Urutan tampil mengikuti model umpan balik *Where am I going? How am I going? Where to next?* (Hattie & Timperley):

1. **Ringkasan satu kalimat** yang berorientasi tugas: "Your estimated score is 505. You are in Intermediate, 38 points from Advanced."
2. **Yang sudah berjalan baik** (1 sampai 3 topik terkuat). Ini bukan hiburan; ia memberi bukti kompetensi yang nyata dari data.
3. **Fokus berikutnya** (maksimal 3 topik prioritas), masing-masing dengan satu tombol ke unit remedial. Label status:

| Status internal | Label tampil | Bukan |
| --- | --- | --- |
| `strong` | Strong | |
| `ok` | On track | |
| `weak` | Needs practice | "Weak" |
| `priority` | Focus next | "Critical", "Failing" |
| `insufficient` | Not enough data yet | |

4. **Perbandingan dengan diri sendiri** (percobaan sebelumnya), bukan dengan orang lain. Penurunan ditulis netral: "Down 6 points from your last simulation. Scores often vary between attempts."
5. **Detail** (per soal, waktu, soal yang membuat stuck, pembahasan) disembunyikan di balik "See details" (*progressive disclosure*).
6. Narasi Claude tampil saat siap; sambil menunggu, angka sudah tampil (bagian 13.3) dengan placeholder tenang "Your personal feedback is on its way."

Soal "stuck" disajikan sebagai "Questions that took longer", tanpa kata stuck.

**Aturan narasi AI tambahan** (ditambahkan ke system prompt analisis dan Konselor):
- Bicara tentang topik, strategi, dan langkah, bukan tentang sifat peserta.
- Penyebab yang disebut harus dapat diubah (strategi membaca, manajemen waktu, konsep yang belum dilatih).
- Maksimal satu kalimat pengakuan usaha, tanpa pujian berlebihan.
- Akhiri dengan satu langkah konkret yang bisa dimulai hari ini.
- Kata yang dilarang di keluaran: *fail, failed, poor, bad, weak student, lazy, behind others*. Validator memeriksa dan meminta ulang bila muncul.

#### 27.4.4 Materi dan unit (`/learn`, `/materials`)

- **Mode baca**: konten di tengah, lebar 68ch, sidebar dapat dilipat, header mengecil saat menggulir.
- Indikator posisi di unit ("Part 2 of 4") dan perkiraan durasi tiap item, karena ketidakpastian durasi menurunkan kemauan memulai.
- Blok interaktif memberi umpan balik segera dan informatif: jawaban benar disertai alasan singkat; jawaban salah memakai `--attention`, menunjukkan jawaban benar dan penjelasannya, serta ajakan mencoba soal serupa.
- Penanda halaman otomatis: kembali ke materi melanjutkan dari posisi terakhir.
- **Pengingat istirahat** (opsional, bawaan nyala): setelah `break_reminder_min` menit belajar aktif, muncul kartu kecil yang tidak memblokir: "You've been learning for 45 minutes. A short break helps you remember more." Tombol: *Take a 5 min break* / *Keep going*. Tidak pernah tampil di ruang tes.
- **Ulasan berjeda**: topik yang membaik dijadwalkan untuk ulasan singkat 3 soal setelah 2, 7, dan 21 hari, muncul sebagai item ringan di kartu Today ("Quick review: 3 questions").

#### 27.4.5 Study plan (`/home`, `/learn`)

- Item aktif maksimal 5 (sudah ada di bagian 15), dan beranda hanya menampilkan 1 sampai 3 untuk hari ini.
- Status `late` ditampilkan sebagai **"Past due"** dengan warna `--attention` dan tombol "Pick a new date" (jika diizinkan kebijakan) atau "Start now". Tidak ada merah, tidak ada hitungan hari terlambat yang besar.
- Item selesai mendapat centang dengan transisi singkat dan kalimat "Nice, one step closer." Penyelesaian plan penuh mendapat layar penutup yang sedikit lebih hangat, tanpa konfeti bawaan.
- **Konsistensi tanpa hukuman**: ditampilkan "Learning days this month: 9", bukan streak harian yang bisa putus. Streak yang hilang memicu rasa kehilangan (*loss aversion*) dan sering membuat orang berhenti.

#### 27.4.6 Coaching (`/coaching`)

- Kalender menampilkan hanya slot yang bisa dipilih; slot yang tidak bisa dipilih tidak ditampilkan atau disamarkan dengan alasan yang jelas ("Full", "Booking closed").
- Sebelum booking, aturan kuota dan batas izin 24 jam disampaikan sekali, singkat, dalam bahasa biasa.
- Setelah sesi, catatan coach yang dibagikan muncul dengan judul "Notes from your coach" dan langsung terhubung ke item plan yang terkait. Ini memperkuat rasa didampingi (keterhubungan dalam SDT).
- Pembatalan oleh coach disampaikan dengan permintaan maaf dan penegasan bahwa kuota tidak berkurang.

#### 27.4.7 Konselor AI (`/counselor`)

- Persona: tenang, ringkas, praktis. Jawaban maksimal sekitar 120 kata kecuali diminta lebih panjang.
- Saran awal (*starter prompts*) yang mengurangi kebingungan memulai: "What should I study today?", "How do I manage time in Reading?", "I feel nervous about the test".
- Untuk ungkapan cemas tentang tes: validasi singkat, satu strategi praktis (misal latihan kondisi tes, strategi per bagian), dan saran berbicara dengan coach. Konselor **tidak** berperan sebagai konselor kesehatan mental. Bila pesan menunjukkan tekanan berat di luar konteks belajar, Konselor menjawab dengan empati, tidak melanjutkan diagnosis, dan menyarankan berbicara dengan orang yang dipercaya atau layanan profesional di institusinya; thread diberi `flag` untuk ditinjau coach/admin sesuai kebijakan privasi mitra (lihat 27.8).
- Kuota pesan ditampilkan halus ("12 messages left this month"), dan peringatan hanya saat tersisa ≤ 5.
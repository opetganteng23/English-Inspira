# Rencana Penataan Ulang English Inspira AI

Disusun 30 Oktober 2026 dari diskusi pemilik dan data pemakaian per 29 Oktober 2026.
Tujuan: fitur yang tidak dipakai tidak mengganggu, setiap pekerjaan punya satu tempat, dan aksi penting tidak perlu dicari.

Kolom **Ukuran**: S = setengah hari, M = 1-2 hari, L = 3-5 hari (perkiraan kasar, bukan janji).

## Sesi 0 · Keputusan pemilik (sebelum mulai)

| No | Keputusan | Pilihan | Dampak ke sesi |
| --- | --- | --- | --- |
| 0.1 | Produk utama dijual sebagai apa | Alat tes & analitik / Program belajar lengkap / Keduanya per klien | Sesi 4 (modul mana yang default aktif) |
| 0.2 | Fitur yang dihapus permanen | Upload External Results, Certificates, Official EPTA Test, Program Cycles, lainnya | Sesi 4 |
| 0.3 | Bahasa UI | Inggris / Dwibahasa / Indonesia | Sesi 7 |
| 0.4 | Susunan menu baru disetujui | Lihat Sesi 2-4 | Semua |

**Diputuskan 30 Oktober 2026:** 0.1 keduanya; English Inspira sebagai penyelenggara (bukan menjual platform), jadi tes dan program belajar diaktifkan per institusi. 0.2 belum dijawab: hapus atau sembunyikan. 0.3 tetap Inggris.

## Sesi 1 · Jalan pintas (cepat terasa, risiko kecil)

**Status: selesai 30 Oktober 2026** (deploy `4b60241` dan `0a6f2a0`). Catatan: 1.2 Reschedule lewat pencarian → "Schedule & actions" → pilih sesi → Move; 1.4 diterapkan pada pesan kosong halaman utama tiap peran (pesan filter tetap); FAQ (1.5) baru untuk peserta.

| No | Item | Masalah sekarang | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Pencarian global admin | Mencari peserta harus masuk menu dulu | Kotak cari di header: nama/email peserta, admin, institusi, tes | M | Ketik nama, hasil muncul < 1 dtk dari halaman mana pun |
| 1.2 | Aksi cepat dari hasil cari | Reschedule harus scroll papan jadwal | Hasil cari punya tombol Reschedule, Lihat hasil, Reset password, Void | M | Reschedule selesai dalam 2-3 klik |
| 1.3 | Profil peserta jadi pusat aksi | Aksi untuk satu orang tersebar | Satu panel aksi: jadwal & pindah sesi, attempt (void/restore/terminate), akun, QA tester, data personel | M | Semua aksi per orang ada di profilnya |
| 1.4 | Halaman kosong dengan arahan | "No data yet" tanpa petunjuk | Setiap empty state menjelaskan langkah berikutnya + tombol menuju tempatnya | S | Tidak ada halaman kosong tanpa arahan |
| 1.5 | Help menjadi FAQ | Menu Help | Ganti nama menjadi FAQ; isi dari kendala nyata saat tes AirNav (audio, Start, simpan, kapan hasil keluar) | S | Menu FAQ tampil untuk semua peran |
| 1.6 | Menu peserta tahap 1 | Semua menu tampil sejak awal | Tahap 1 = belum punya hasil placement yang dirilis: hanya Home, My Tests (untuk memulai tes), Test Results, Profile, FAQ. Menu lain muncul otomatis setelah hasil dirilis | S | Peserta AirNav tahap 1 hanya melihat 5 menu |
| 1.7 | Saklar AI Counselor | Selalu tampil | Admin menyalakan/mematikan di Settings. Mati = menu, halaman, dan API hilang untuk semua peran; data percakapan tetap disimpan. Awal: **mati** | S | Saat mati, /counselor dan API-nya tidak bisa diakses |
| 1.8 | Batas scope AI Counselor | AI menjawab apa saja | Prompt menolak pertanyaan di luar belajar bahasa Inggris dan program English Inspira; pernyataan tetap di atas chat: "AI Counselor only answers questions about learning English and the English Inspira program." | S | Pertanyaan di luar scope ditolak dengan sopan |
| 1.9 | Tombol Back admin | Sebagian halaman admin tanpa Back | Audit semua halaman admin, tambahkan Back yang belum ada | S | Semua halaman turunan admin punya Back |
| 1.10 | Label portal institusi | "Institution admin" | Teks tampilan menjadi "Institutions" (kode `inst_admin` tetap) | S | Tidak ada teks "Institution admin" di portal |

## Sesi 2 · Halaman Institusi bertab (pusat urusan satu klien)

**Status: selesai 30 Oktober 2026** (deploy `f6ac7b8`) di `/admin/institutions/[id]`. Tab portal dipakai ulang lewat `InstScope`. Ikut dikerjakan lebih awal dari Sesi 4: sidebar admin dirapikan (menu harian + "More tools" tertutup). 2.5 selesai (`65a0ca1`): tab Tests & schedule bisa pindah sesi, hanya peserta institusi itu. 2.6 ditunda ke 4.5: Class Results belum pernah dipakai (0 data), diputuskan bersama fitur lain yang dimatikan.

| No | Tab | Isi dipindah dari | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 2.1 | Overview | Tabel Institutions | Ringkasan: kursi, kontrak, jumlah peserta, status Hold, modul aktif | S | Klik institusi membuka halaman, bukan dialog |
| 2.2 | Participants | Participants + dialog Add participants | Daftar, tambah, undang, impor peserta institusi ini | M | Tambah peserta tanpa keluar halaman institusi |
| 2.3 | People | Coaches & Admins | Admin institusi & coach institusi ini: tambah, ubah, nonaktifkan, reset password | S | Membuat admin AirNav dari halaman AirNav |
| 2.4 | Personnel data | Tombol Personnel data | Impor HR + laporan cocok/tidak cocok (daftar yang tidak cocok) | M | Peserta tanpa data personel terlihat langsung |
| 2.5 | Tests & schedule | Halaman tes / papan jadwal | Sesi tes untuk institusi ini, reschedule, export per sesi | M | Jadwal satu klien terlihat tanpa melihat klien lain |
| 2.6 | Classes | Classes + Class Results | Kelas institusi ini dan hasil kelas, digabung | S | Menu Class Results tidak diperlukan lagi |
| 2.7 | Results & reports | Analytics + Edit institusi | Analytics, Excel, Executive Summary, rilis hasil | M | Semua laporan klien dari satu tab |
| 2.8 | Settings | Dialog Edit | Data institusi, kode pendaftaran, kontrak, Hold & cakupannya, modul aktif | S | Dialog Edit lama dihapus |

## Sesi 3 · Halaman Tes bertab + Test day dashboard

**Status: sebagian, 30 Oktober 2026** (deploy `54ba035`, `056af63`). Selesai: daftar Tests jadi tabel (tab Tests / Course quizzes, filter Live-Draft-Archived, cari, urut), arsip tes, halaman `/admin/tests/[id]` dengan tab Overview, Questions & settings, Schedule, Results, Preview as participant yang bisa dicoba tanpa disimpan, tautan buat quiz dari editor unit. Kemudian (`65a0ca1`, `852c573`): rekap perubahan jadwal di papan jadwal (3.2; pindah massal sudah ada sebelumnya), tab Live (test day) per sesi (3.3). **Sesi 3 selesai.**

| No | Item | Masalah sekarang | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Tab Setup | Aturan tes tersebar | Soal, bagian, waktu, mode aman, jeda rilis, live screen, pengingat dalam satu tab dengan ringkasan "tes ini berjalan dengan aturan apa" | M | Semua aturan tes terbaca di satu layar |
| 3.2 | Tab Schedule | Papan jadwal panjang | Sesi dengan filter & cari, pindah sesi massal, rekap perubahan | M | Tidak perlu scroll jauh untuk satu peserta |
| 3.3 | Tab Live (Test day) | Kehadiran, monitoring, proctoring, hasil di halaman berbeda | Per sesi: belum masuk / sedang mengerjakan / bermasalah / selesai, dengan aksi langsung | L | Hari tes dijalankan dari satu layar |
| 3.4 | Tab Results | Analytics terpisah | Hasil tes ini, export, Executive Summary | S | Laporan per tes dari halaman tes |

## Sesi 4 · Modul per institusi + menu rapi

**Status: sebagian, 30 Oktober 2026** (deploy `0705abc`). 0.2 diputuskan: fitur disembunyikan dengan saklar, tidak dihapus. Selesai: 4.1 (saklar global Learning, Coaching, AI Counselor, Official EPTA Test, Certificates, Class/external results, Program cycles, semua mati sejak awal; modul Learning dan Coaching per institusi), 4.2 (menu peserta: Home, My Tests, Test Results, Profile, FAQ), 4.4, 4.5 (dengan saklar). 2.6 gugur karena Class Results ikut saklar. 4.3 selesai (`6dd0071`): menu harian admin 8 item; Audio dan Media jadi tab Question Bank, Participants dan Coaches & admins jadi tab People. **Sesi 4 selesai.**

| No | Item | Masalah sekarang | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 4.1 | Modul per institusi | Semua fitur tampil untuk semua klien | Centang modul: Placement, Learning, Coaching, AI Counselor, Official Test, Certificates | M | Modul mati tidak terlihat sama sekali oleh peserta, coach, admin institusi |
| 4.2 | Menu peserta | 12 menu, banyak kosong | Home, My Tests (jadwal + hasil), Learn (course + materi), AI Counselor, Profile; sisanya muncul bila modul aktif | M | Peserta AirNav melihat ≤ 5 menu |
| 4.3 | Menu admin | 20 menu dalam 4 kelompok | Dashboard, Institutions, Tests, Content, Monitoring, Settings; Participants & Coaches jadi pencarian lintas institusi | M | Menu admin ≤ 8 item |
| 4.4 | Sembunyikan menu kosong | Official EPTA Test, Certificates, Coaching tampil kosong | Menu tampil hanya bila ada isi atau modul aktif | S | Tidak ada menu yang berujung halaman kosong |
| 4.5 | Hapus fitur yang diputuskan (0.2) | Kode dan menu tidak terpakai | Hapus menu, rute, API; data lama diarsip | M | Fitur terhapus tidak muncul di mana pun |

## Sesi 5 · Pengaturan satu tempat + aksi berbahaya aman

**Status: selesai 30 Oktober 2026** (deploy `2f5b746`). 5.1: Settings bertab (General & features, Rules & parameters, Scoring profiles). 5.2: rilis hasil institusi hanya lewat tombol Release dengan ringkasan dampak dan ketik RELEASE; hapus centang Hold ditolak bila masih ada hasil ditahan. 5.3: `askDanger` (dampak, alasan, ketik kata) dipakai untuk rilis, void, restore, terminate, reset, hapus tes, hapus sesi. Hapus-hapus kecil (soal, gambar, materi) tetap konfirmasi biasa.

| No | Item | Masalah sekarang | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Satukan pengaturan | System Parameters, Settings, Scoring Profiles terpisah | Satu menu Settings dengan tab: Umum, Skor & level, Email, Tampilan, Keamanan | M | Satu menu pengaturan |
| 5.2 | Rilis hasil yang jelas | Rilis = hapus centang di dialog Edit | Tombol "Release results" dengan ringkasan dampak (jumlah peserta, email terkirim) + ketik konfirmasi | S | Tidak ada rilis tak sengaja |
| 5.3 | Aksi berbahaya seragam | Void/Terminate/Reset/Delete di beberapa tempat | Satu pola: zona "Danger" di profil/tes, ringkasan dampak, alasan wajib, tercatat audit | M | Semua aksi berbahaya punya pola yang sama |

## Sesi 6 · Data dan otomasi (tidak bergantung pada developer)

**Status: selesai 30 Oktober 2026** (deploy `3758070`, `50bd673`). 6.1: tombol Generate AI narratives di tab Results tes (admin saja), perkiraan jumlah dan token sebelum mulai, progres, token aktual. 6.2: Excel/PowerPoint disiapkan di latar (koleksi `jobs`, berkas GridFS `reports`, disimpan 7 hari); uji di server: Excel placement 1.385 peserta selesai dalam 14 detik. 6.3: halaman Data quality (More tools). 6.4: impor peserta di halaman institusi sekaligus membaca kolom HR dari Excel yang sama.

| No | Item | Masalah sekarang | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 6.1 | Generate narasi AI dari UI | Lewat script di server | Tombol "Generate narratives" per tes/institusi, progres, perkiraan biaya | M | Admin membuat narasi tanpa developer |
| 6.2 | Laporan berat di latar | Analytics/Excel/PPT bisa timeout | Laporan dibuat di latar, notifikasi saat siap, unduh dari daftar laporan | L | Unduh laporan 1.000+ peserta tanpa 504 |
| 6.3 | Data quality check | Dicek manual lewat script | Halaman: tanpa data personel, nama kosong, akun dobel, soal kosong terselip | M | Masalah data terlihat tanpa query manual |
| 6.4 | Impor peserta + personel sekaligus | Dua impor terpisah, cocok lewat email | Satu impor, laporan cocok/tidak cocok, perbaiki di tempat | M | Satu kali impor per klien |

## Sesi 7 · Bahasa, visibilitas sistem, dan backup

**Status: sebagian, 30 Oktober 2026** (deploy `01d929f`). 7.1 batal (UI tetap Inggris, keputusan 0.3). 7.2: Email log di More tools (isi email tidak ditampilkan; OTP dan reset password tidak bisa dikirim ulang). 7.3: kartu Database backup di Settings, merah bila backup terakhir > 30 jam (saat dibuat: 34 jam, cron belum dipasang). Belum: 7.4 salinan ke luar VPS (perlu tujuan dan akun dari pemilik).

| No | Item | Masalah sekarang | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- | --- |
| 7.1 | Bahasa UI | Inggris, laporan Indonesia | Sesuai keputusan 0.3 | M-L | Konsisten di UI, email, laporan |
| 7.2 | Log email | Status email tidak terlihat | Halaman email: terkirim, gagal, alasan, kirim ulang | M | Email gagal terlihat dan bisa dikirim ulang |
| 7.3 | Status backup | Tidak terlihat dari aplikasi | Settings menampilkan backup terakhir, ukuran, peringatan bila > 1 hari | S | Admin tahu backup berjalan |
| 7.4 | Backup ke luar server | Backup hanya di VPS yang sama | Salin otomatis ke penyimpanan luar (mis. Google Drive / object storage) | M | Ada salinan di luar VPS |

## Sesi 8 · Pusat bantuan: tiket, AI troubleshooting, dashboard CS & Technical

**Status: 8.1-8.7 selesai 30 Oktober 2026** (deploy `4b27e65`): tombol Help mengambang (peserta, institusi, coach; ruang tes belum), `/support` bisa tanpa login (tautan "Need help?" di sign-in, akses tiket lewat token di email), My requests, `/admin/support` dengan antrean CS/Technical, catatan internal, konteks pengirim, email + notifikasi, WhatsApp untuk tiket urgent tanpa balasan 15 menit. **8.8 dan tombol Help ruang tes selesai 31 Oktober 2026**: Help di header ruang tes (tanpa tautan keluar, timer tetap berjalan, kategori otomatis "During the test"); FAQ institusi dan coach di `/support`; saklar "AI help before a ticket" (mati secara bawaan): FAQ dicocokkan tanpa AI, lalu AI model ringan hanya dari FAQ, maks 3 pertanyaan, diteruskan ke tim bila diminta, gagal 2 kali, atau perlu tindakan; percakapan terlampir di tiket sebagai catatan staf.

Tujuan: kendala peserta dan klien masuk lewat sistem, bukan WhatsApp. WhatsApp hanya jalan terakhir.
Batas tegas: **chatbot hanya untuk kendala teknis/operasional. Tidak punya akses ke skor, hasil, level, atau penilaian**, dan tidak pernah melakukan aksi (reschedule, reset, dsb.).

| No | Item | Perubahan | Ukuran | Selesai bila |
| --- | --- | --- | --- | --- |
| 8.1 | Tombol Help mengambang | Pojok kanan bawah di semua halaman peserta, institusi, coach (termasuk halaman persiapan tes). Di ruang tes: form singkat, timer tidak dijeda | S | Help bisa dibuka dari halaman mana pun |
| 8.2 | Form tiket wajib | Nama, email, kendala, kategori (Account / Schedule / During the test / Audio / Other). Terisi otomatis bila login; bisa dipakai tanpa login dari halaman sign-in | M | Tiket tanpa nama, email, atau kendala ditolak |
| 8.3 | My tickets | Riwayat tiket dan balasan admin untuk pengirim | S | Peserta melihat balasan tanpa WA |
| 8.4 | Dashboard admin Support | Dua tampilan: **CS** (akun, jadwal, umum) dan **Technical** (audio, error, koneksi, tes nyangkut). Status: New, In progress, Waiting for user, Resolved; label Urgent untuk kendala saat tes; pindah tiket antar tim | M | CS dan Technical bekerja di antrean masing-masing |
| 8.5 | Konteks di samping chat | Profil pengirim, jadwal sesi, attempt berjalan, status koneksi, tombol aksi (Reschedule, Reset, Terminate) dijalankan **oleh admin** | M | Admin menyelesaikan tiket tanpa pindah halaman |
| 8.6 | Notifikasi | Notifikasi aplikasi + email saat tiket dibalas; notifikasi admin untuk tiket baru/urgent | S | Pengirim tahu ada balasan |
| 8.7 | WA jalan terakhir | Tombol WA admin hanya muncul bila tiket urgent belum dibalas dalam batas waktu yang diatur | S | WA tidak tampil di luar kondisi itu |
| 8.8 | AI troubleshooting (setelah 8.1-8.7 berjalan) | Menjawab hanya dari FAQ dan panduan resmi; FAQ dicocokkan dulu tanpa AI untuk hemat biaya; model termurah, batas pesan per tiket; diteruskan ke admin bila pengguna meminta, AI gagal 2 kali, atau perlu tindakan. Percakapan AI terlampir di tiket. Saklar on/off oleh admin | M | Kendala umum selesai tanpa admin; sisanya masuk tiket lengkap dengan riwayat |

## Urutan yang disarankan

1. Sesi 0 (keputusan), lalu Sesi 1: cepat terasa, tidak mengubah susunan besar.
2. Sesi 2 dan 3: perubahan susunan terbesar.
3. Sesi 4 dan 5: merapikan menu dan pengaturan setelah rumah barunya ada.
4. Sesi 6 dan 7: kemandirian tim dan keamanan data.

Setiap sesi dikirim terpisah, diuji, lalu di-deploy; menu lama dibiarkan sampai penggantinya siap agar operasional tidak terganggu.

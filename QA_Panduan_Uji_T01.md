# Panduan Uji QA: Placement Test T01 dan Fitur Terkait

Versi dokumen: 17 Oktober 2026 · Versi sistem yang diuji: `4759511` · Lokasi: https://english.edulyfe.id (produksi)

Dokumen ini berisi apa yang perlu diuji, langkahnya, dan hasil yang benar. Tulis hasilnya di kolom **Hasil** (Lulus / Gagal / Tidak bisa diuji) dan kirim kembali bersama temuan.

---

## 1. Ringkasan

Putaran QA sebelumnya (16–17 Oktober) menemukan beberapa masalah. Semuanya sudah diperbaiki dan **perlu diuji ulang**, ditambah beberapa fitur baru:

| Perubahan | Yang perlu dibuktikan |
|---|---|
| Audio Listening hanya jalan di soal pertama (kritis) | Audio bisa diputar di setiap soal |
| Tag internal (`oce`, `test-NN`, `written-expression`) bocor ke diagnostic | Tidak ada lagi di rincian topik dan study plan |
| Refresh mengembalikan ke soal 1 | Kembali ke soal terakhir |
| **Baru:** Secure mode di T01 | Tidak bisa mundur, tidak bisa salin dan klik kanan |
| **Baru:** Acak soal per bagian | Urutan berbeda antar peserta, struktur Part A, B, C terjaga |
| **Baru:** Hasil ditahan 2 jam | Peserta biasa baru melihat nilai 2 jam setelah mulai |
| **Baru:** Ekspor hasil dan diagnostic ke PDF | PDF terunduh dan isinya benar |
| **Baru:** PURE dan OCE dihapus dari hasil peserta | Hanya skor EPTA dan CEFR |
| **Baru:** nama tes menjadi **EPTA (English Proficiency Test & Analytics)**, tanpa embel-embel TOEFL atau ITP | Tidak ada kata TOEFL atau ITP di layar peserta, email, PDF, dan halaman publik (bagian J) |
| **Baru:** Sertifikat resmi pihak ketiga | Admin unggah, peserta lihat dan unduh |
| Perbaikan kecil: captcha terbaca, login saat pemeliharaan, email dengan tautan salinan | Lihat bagian F dan G |

## 2. Aturan yang wajib dipatuhi

1. **Jangan menyalakan Active pada T01 dan jangan mematikan Test mode.** Itu membuka tes ke ±1.400 peserta AirNav, dan placement menentukan level mereka secara permanen.
2. **Jangan memakai akun peserta AirNav yang asli.** Gunakan hanya akun uji.
3. **Jangan menambah peserta atau staf dengan email asli orang lain.** Sistem langsung mengirim email undangan. Pakai alamat email milik tim QA sendiri.
4. Jangan menghapus atau mengubah data selain akun dan tes uji yang kamu buat sendiri.
5. Kalau ragu, berhenti dan tanyakan dulu.

## 3. Keadaan T01 saat ini

| Pengaturan | Nilai |
|---|---|
| Nama tes | `[UJI COBA INTERNAL - JANGAN DIAKTIFKAN] OCE Placement T01` |
| Tipe | Placement |
| Test mode | **Menyala** (hanya admin dan QA tester yang melihatnya) |
| Active | **Mati** |
| Secure mode | Menyala |
| Acak soal per bagian | Menyala |
| Acak opsi jawaban | Mati |
| Hasil ditahan | 120 menit sejak peserta mulai (**admin dan QA tester dikecualikan**) |

Struktur: 140 soal, 115 menit.

| Section | Durasi | Soal | Bagian |
|---|---|---|---|
| Listening | 35 menit | 50 | Part A: soal 1–30 · Part B: 31–38 · Part C: 39–50 |
| Structure & Written Expression | 25 menit | 40 | Structure: 1–15 · Written Expression: 16–40 |
| Reading | 55 menit | 50 | 5 bacaan, 10 soal per bacaan |

## 4. Akun dan persiapan

| Kebutuhan | Keterangan |
|---|---|
| Akun **QA tester** (peserta) | Sudah ada. Melihat T01 di menu My Tests. Hasil tampil langsung (tanpa tahanan 2 jam) |
| Akun **admin** | Untuk uji pengaturan tes, sertifikat resmi, dan sebagai pembanding urutan soal |
| Dua browser atau profil terpisah | Untuk membandingkan urutan soal antar akun dan uji dua tab |
| Headphone atau speaker | Audio **harus didengar**, bukan hanya dilihat tombolnya |
| Satu ponsel sungguhan | Android dan/atau iPhone |

Cara masuk: `/sign-in` (peserta) atau `/admin/login` (admin), tab **Password** atau **Email code**.

---

## 5. Daftar uji

### A. Alur pengerjaan T01 (akun QA tester)

| ID | Uji | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|---|
| A1 | T01 tampil | Masuk, buka **My Tests** | T01 tampil dengan label **Test mode** | |
| A2 | Persiapan | Klik T01, ikuti layar persiapan (tes suara, aturan, persetujuan), lalu Start | Tes dimulai di section Listening, timer 35:00 berjalan | |
| A3 | **Audio Part A** | Soal 1: klik **Start audio**. Setelah selesai pindah ke soal 2, 3, 4, dan seterusnya (cek minimal 10 soal) | Tiap soal punya tombol Start audio sendiri. Audio terdengar jelas. Tidak ada tombol jeda atau ulang. Setelah selesai tombol hilang dan tertulis "Audio has been played" | |
| A4 | **Audio Part B dan C** | Buka soal pertama tiap blok (Part B dan C), putar audio | Audio hanya terputar sekali per blok. Soal berikutnya di blok yang sama memakai audio yang sama (tulisan "Audio has been played" di soal itu adalah **wajar**) | |
| A5 | Audio tidak bisa dicurangi | Saat audio berjalan: geser posisi, coba ulang, refresh halaman | Geser dibatalkan. Setelah refresh audio melanjutkan dari posisi terakhir, **tidak** mengulang dari awal | |
| A6 | **Secure mode** | Cari tombol Previous, klik nomor soal sebelumnya di navigator, salin teks soal (Ctrl+C), tempel, klik kanan, tombol Back browser | Tidak ada Previous. Nomor sebelumnya terkunci. Salin, tempel, klik kanan, dan Back tidak berfungsi. Ada tulisan "Secure mode: you cannot go back" | |
| A7 | **Acak per bagian** | Masuk dengan akun QA (browser 1) dan akun admin (browser 2). Mulai T01 di keduanya. Catat 3 soal pertama di Part A dan di Written Expression | Urutan soal **berbeda** antar akun. Part A tetap di 1–30, Part B di 31–38, Part C di 39–50. Structure tetap sebelum Written Expression | |
| A8 | Soal satu audio/bacaan tetap berurutan | Di Part B/C dan Reading, perhatikan soal yang berbagi audio atau bacaan | Soal-soal itu muncul berurutan, tidak terpisah | |
| A9 | **Jawaban ikut soalnya** | Jawab 5 soal, catat soal dan pilihanmu. Refresh. Cek ulang | Pilihan masih menempel di soal yang sama (tidak bergeser) | |
| A10 | **Refresh** | Pindah ke soal sekitar nomor 10, refresh | Kembali ke soal yang sama (bukan soal 1), urutan sama | |
| A11 | Timer dan section | Biarkan section Listening habis, atau tekan **Finish section** dengan beberapa soal kosong | Dialog menampilkan nomor soal yang belum dijawab. Setelah dikonfirmasi pindah ke Structure dengan timer 25:00. Section sebelumnya tidak bisa dibuka lagi | |
| A12 | Putus koneksi | Matikan internet, jawab satu soal, nyalakan lagi | Muncul "Save failed, retrying", lalu tersimpan setelah koneksi kembali | |
| A13 | **Dua tab** | Buka percobaan yang sama di dua tab. Pada section terakhir tekan **Submit** di kedua tab hampir bersamaan | Tidak ada halaman error. Keduanya berakhir di halaman hasil | |
| A14 | Tidak ada umpan balik di dalam tes | Selama tes, perhatikan setelah menjawab | Tidak ada tanda benar atau salah, kunci, atau penjelasan sebelum tes selesai | |

### B. Halaman hasil (akun QA tester, tampil langsung)

Setelah submit, buka **Test Results** dan hasilnya.

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| B1 | Skor | Skor estimasi dan skor per section (Listening, Structure & WE, Reading) tampil. Jumlah benar sesuai jawabanmu | |
| B2 | Level dan padanan skor | Level (Basic/Intermediate/Advanced), CEFR, dan skor EPTA. **Tidak ada kartu PURE atau OCE** | |
| B3 | **Breakdown by question type** | Ada tab **Listening / Structure & WE / Reading**. Tiap tab menampilkan **semua** jenis soal section itu (bukan hanya 8 teratas), terurut dari skor terendah. Di tab Listening ada baris **By part** (Part A, B, C). Part A/B/C **tidak** muncul sebagai jenis soal. Jenis dengan kurang dari 3 soal bertanda "(few questions)". Tidak ada `oce`, `test-NN`, atau `written-expression`. Jumlah jenis soal masuk akal (contoh T01: ±14 Listening, ±18 Structure, ±9 Reading) | |
| B4 | **Analisis per placement** | Kartu **Analysis of this placement test** (awalnya "Preparing the analysis…", lalu terisi ±1 menit): ringkasan, kekuatan, bagian yang perlu diperkuat, langkah berikutnya. **Semua angka hanya dari placement ini**: jumlah butir per jenis soal sama dengan yang tampil di Breakdown (mis. verb-form 6 butir), **bukan** gabungan semua percobaan (tidak ada tulisan seperti "across 66 items"). Tes ulang di akun QA menghasilkan analisis yang berbeda sesuai hasil masing-masing | |
| B5 | Rekomendasi course | Tampil bila ada course yang cocok (sekarang course masih kosong, jadi bagian ini bisa tidak muncul: **wajar**) | |
| B6 | **Tidak ada teks soal** | Tidak ada bagian Answer review. Halaman tidak menampilkan teks soal, opsi, kunci jawaban, penjelasan, atau transkrip audio. Yang tampil hanya angka dan grafik per section dan jenis soal (benar, salah, kosong) | |
| B7 | Study plan dan Home | Home menampilkan level, skor, dan kuota coaching | |

### C. Ekspor PDF

| ID | Uji | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|---|
| C1 | Dari halaman hasil | Klik **Export results (PDF)** | PDF terunduh | |
| C2 | Dari daftar hasil | Di **Test Results** klik tombol **PDF** pada satu baris | PDF terunduh (kartu tetap bisa diklik untuk membuka hasil) | |
| C3 | Isi PDF | Buka PDF | Memuat nama, judul tes, skor, level, CEFR, skor per section, rincian jenis soal per section (6 terlemah per section, dengan baris By part), analisis AI, rekomendasi. **Tanpa** PURE/OCE dan **tanpa** pembahasan per soal. Teks rapi, tidak terpotong, semua halaman terbaca | |
| C4 | PDF saat analisis belum siap | Buka hasil segera setelah rilis dan perhatikan tombol Export | Selama analisis disiapkan tombol abu-abu bertuliskan "analysis preparing…". Dari daftar hasil, PDF menunggu analisis selesai (maksimal ±40 detik), jadi PDF **tidak** berisi tulisan "analysis is still being prepared" | |
| C5 | Akses orang lain | Salin alamat PDF, buka dengan akun peserta lain | Ditolak (tidak ditemukan) | |

### D. Hasil ditahan 2 jam (wajib akun peserta biasa)

Akun QA dan admin **dikecualikan** dari penahanan, jadi uji ini butuh akun peserta tanpa tanda QA. Cara aman tanpa membuka T01:

1. Selesaikan T01 dengan akun QA (supaya akun itu punya placement). Lalu di **Admin → Participants**, buka akun QA itu dan klik **Remove QA tester** (sementara).
2. Di **Admin → Tests**, buat satu tes **Simulation** kecil (misalnya 5 soal Structure), isi **Release results after = 5**, nyalakan **Active**. (Peserta nyata tidak bisa memulainya karena belum ada yang menyelesaikan placement; saat ini hanya akun QA yang sudah.)
3. Kerjakan tes kecil itu dengan akun tadi.

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| D1 | Setelah submit | Muncul halaman **"Your result is being prepared"** dengan jam rilis (WIB). Halaman memeriksa ulang otomatis | |
| D2 | Home | Kartu status "Your result is being prepared" | |
| D3 | Daftar hasil | Baris tes itu bertuliskan "Result pending" dan jam tersedia. **Tidak ada skor**, tidak ada tombol PDF | |
| D4 | Daftar tes | Skor terakhir tes itu **tidak** tampil | |
| D5 | Alamat langsung | Buka alamat hasil dan alamat PDF langsung | Hasil tidak terbuka (tertahan) | |
| D6 | Email | Tidak ada email hasil sebelum waktu rilis | |
| D7 | Setelah 5 menit | Skor, rincian, analisis, dan pembahasan terbuka. Email hasil dan notifikasi masuk | |
| D8 | Placement tidak bisa diulang selama ditahan | (Hanya bisa diuji bila ada placement yang sedang ditahan. Lewati bila tidak mungkin) | |

Setelah selesai: **nyalakan kembali** tanda QA tester pada akun itu (Make QA tester), dan **nonaktifkan** tes kecil tadi.

### E. Sertifikat resmi pihak ketiga

Butuh satu sesi tes resmi, satu pendaftar, dan skor resmi. Pakai **data fiktif** (NIK 16 digit fiktif) dan akun uji.

| ID | Uji | Langkah | Hasil yang benar | Hasil |
|---|---|---|---|---|
| E1 | Sebelum ada skor | Admin → **Official Test Schedule & Scores** → buka sesi → kolom **Official certificate** | Tertulis "Save the scores first" | |
| E2 | Unggah | Simpan skor (31–68 per section), lalu klik **Upload PDF/JPG/PNG**, pilih PDF | Muncul "Attached: nama-file.pdf" | |
| E3 | Peserta melihat | Masuk sebagai peserta itu → **Certificates** | Kartu **Official certificate from the test organizer** dengan tombol **View certificate** dan **Download certificate** | |
| E4 | Lihat dan unduh | Klik keduanya | View membuka di tab baru, Download mengunduh. Isinya sama dengan yang diunggah | |
| E5 | Berkas palsu | Ganti nama file `.html` menjadi `.pdf`, unggah | Ditolak ("Only PDF, JPG, or PNG files are accepted") | |
| E6 | Terlalu besar | Unggah berkas di atas 10 MB | Ditolak | |
| E7 | Jenis lain | Unggah JPG dan PNG asli | Diterima dan tampil dengan benar | |
| E8 | Ganti dan hapus | **Replace**, lalu **Remove** | Berkas berganti, lalu hilang dari sisi peserta. Skor dan sertifikat bawaan tetap ada | |
| E9 | Akses orang lain | Salin alamat View, buka dengan akun peserta lain | Ditolak | |

### F. Email dan login

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| F1 | Tambah satu akun admin uji (email milik tim QA) di **Admin → Coaches & Admins** | Email "You have been added as Admin" masuk, ada tombol **Create my password** dan tulisan tautan yang bisa disalin | |
| F2 | Klik tautan itu | Halaman membuat password terbuka, setelah itu bisa masuk | |
| F3 | Email undangan peserta (bila ada akun uji berstatus invited) | Ada tombol dan tulisan tautan salinan di bawahnya | |
| F4 | Login dengan **Email code** untuk akun `invited` | Kode 6 digit tiba, login berhasil tanpa tautan | |

### G. Captcha dan mode pemeliharaan

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| G1 | Captcha di `/sign-in` dan `/admin/login` | Gambar terbaca jelas (5 karakter, tidak bertumpuk). Tombol **New characters** menghasilkan gambar baru. Huruf kecil diterima | |
| G2 | Salah ketik captcha | Pesan error jelas, bisa mencoba lagi | |
| G3 | Mode pemeliharaan (**koordinasikan dengan developer sebelum menyalakannya**) | `/admin/login` tetap bisa dipakai dengan captcha. Peserta melihat halaman pemeliharaan | |

### H. Form tes admin

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| H1 | **Admin → Tests → Edit T01** | Kotak **Test rules** tampil (Secure mode, Shuffle question order, Shuffle within parts, Shuffle answer options). Ada kolom **Release results after (minutes)** | |
| H2 | Dua jenis acak | Mencentang satu otomatis mematikan yang lain | |
| H3 | Tes baru | Form tes baru dimulai dengan **Active mati** dan **Test mode menyala** | |
| H4 | Tes yang hanya dikerjakan QA/admin | Susunan soal tidak terkunci oleh percobaan QA | |

### I. Perangkat

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| I1 | Kerjakan sebagian T01 di **ponsel** (portrait): tombol audio, navigator, timer, keyboard tidak menutupi jawaban | Semua bisa dipakai tanpa terpotong | |
| I2 | Audio di iPhone/Safari dan Android/Chrome | Audio bisa diputar lewat tombol Start | |
| I3 | Lebar layar sempit (±744 px) | Tombol bawah berlabel **Done** (di layar lebar **Finish section**). Ini **wajar** | |
| I4 | Browser lain (Firefox, Safari, Edge) | Alur A dan B berjalan | |

### J. Penamaan EPTA (tanpa TOEFL dan ITP)

Nama tes sekarang **EPTA (English Proficiency Test & Analytics)**. Periksa bahwa kata **TOEFL** dan **ITP** tidak muncul di layar yang terlihat pengguna.

| ID | Uji | Hasil yang benar | Hasil |
|---|---|---|---|
| J1 | Halaman publik: landing `/`, `/terms`, `/privacy`, footer, tab browser | Tertulis EPTA. Tidak ada TOEFL atau ITP. Tidak ada kalimat merek dagang ETS di footer | |
| J2 | Layar peserta: Home, My Tests, hasil, Certificates, Help, Profile (kolom "Target score"), menu "Official EPTA Test" | Tidak ada TOEFL atau ITP | |
| J3 | Halaman hasil dan PDF | Tertulis **Estimated EPTA score** dan kartu padanan **EPTA** dan **CEFR**. Catatan kaki tidak menyebut TOEFL | |
| J4 | Email (undangan peserta, undangan staf, konfirmasi pendaftaran tes resmi) | Judul dan isi menyebut EPTA, bukan TOEFL ITP | |
| J5 | Layar admin: menu "Official Test Schedule & Scores", Tests, Scoring Profiles, Classes, Cycles, Settings, dasbor | Tidak ada TOEFL atau ITP di label dan teks bantuan | |
| J6 | Analisis AI dan Konselor AI | Teks yang dihasilkan tidak menyebut TOEFL atau ITP (periksa beberapa hasil dan beberapa percakapan) | |
| J7 | Verifikasi sertifikat `/verify/<nomor>` | Halaman menyebut "Official EPTA certificates". Nomor sertifikat resmi baru berawalan `EPTA-OFC-` | |

Catatan: menu Learn dan Materials mungkin masih memuat satu materi draf berjudul "Mengenal TOEFL ITP…". Itu isi buatan penulis konten, bukan teks sistem, dan belum diterbitkan.

---

## 6. Hal yang sudah diketahui (tidak perlu dilaporkan)

- Di akun QA, placement bisa diulang berkali-kali. Itu disengaja untuk penguji.
- Catatan "test activity notes" muncul bila berpindah tab atau keluar layar penuh. Itu wajar.
- Skor berlabel **Provisional conversion** karena Scoring Profile resmi belum dipasang.
- Menu Learn, Materials, Coaching, dan Official EPTA Test masih kosong, dan konselor AI bisa menyebut latihan yang belum ada.
- Study plan dan jumlah soal topik dihitung kumulatif dari semua percobaan (keputusan desain masih menunggu pemilik).
- Judul tes masih memuat "UJI COBA INTERNAL" dan "OCE". Akan diganti saat tes dibuka ke peserta.
- Satu soal yang berbagi audio dengan soal di atasnya menampilkan "Audio has been played". Itu wajar (satu audio per blok).

## 7. Cara melapor

Untuk setiap temuan tulis:

```
ID uji       : (mis. A3)
Ringkasan    : satu kalimat
Akun         : QA / admin / peserta biasa
Perangkat    : (mis. Chrome 130 Windows, atau iPhone 14 Safari)
Langkah      : 1... 2... 3...
Seharusnya   : ...
Kenyataannya : ...
Bukti        : tangkapan layar atau rekaman (cantumkan alamat halaman dan jam kejadian)
```

Tingkat keparahan:

| Tingkat | Contoh |
|---|---|
| **Kritis** | Tes tidak bisa dikerjakan, jawaban hilang atau bergeser, jawaban terlihat sebelum waktunya, hasil bocor sebelum rilis, data peserta terlihat orang lain |
| **Tinggi** | Fitur utama gagal tapi ada jalan lain, skor salah, error 500 |
| **Sedang** | Tampilan rusak, pesan membingungkan, urutan salah |
| **Rendah** | Salah ketik, perbaikan kosmetik |

Kalau menemukan sesuatu yang **kritis**, beri tahu developer segera, jangan menunggu laporan akhir.

## 8. Pembersihan setelah uji

- Pastikan tanda **QA tester** menyala kembali di akun QA bila sempat dimatikan (uji D).
- Nonaktifkan tes kecil yang dibuat untuk uji D.
- Hapus atau nonaktifkan akun admin atau peserta uji yang dibuat untuk uji E dan F.
- Pastikan T01 tetap **Active mati** dan **Test mode menyala**.
- Catat akun dan data uji apa saja yang kamu buat, supaya developer bisa membersihkannya.

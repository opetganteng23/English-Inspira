# Spesifikasi Modul LMS TOEFL ITP
## Daftar Fitur dan Pengelolaan Konten Akademik

Dokumen ini merangkum modul dan fitur yang disarankan untuk LMS persiapan TOEFL ITP, dengan fokus pada pengelolaan bank soal, course, audio, media, ujian, penilaian, dan administrasi.

## 1. Modul Utama yang Wajib Dapat Dikelola Admin

### 1.1 Question Bank — Bank Soal
Pusat seluruh pertanyaan TOEFL ITP yang dapat digunakan kembali untuk latihan, kuis, section test, dan simulasi.

Data yang dikelola:
- Soal, pilihan jawaban, dan kunci jawaban.
- Pembahasan jawaban.
- Kategori, topik, skill, tingkat kesulitan, dan tag.
- Lampiran media.
- Status publikasi.
- Riwayat revisi dan versi soal.
- Sumber materi dan informasi lisensi.

### 1.2 Audio Library
Pusat penyimpanan dan pengelolaan audio untuk Listening Comprehension.

Data dan fitur:
- Upload file MP3, WAV, atau format lain yang diizinkan.
- Judul, deskripsi, kategori, durasi, ukuran, dan format audio.
- Pengelompokan berdasarkan short conversation, longer conversation, atau talk.
- Audio player untuk preview.
- Waveform, play/pause, volume, dan durasi.
- Transkrip dan timestamp bila diperlukan.
- Relasi audio dengan satu atau beberapa soal.
- Status pemrosesan dan validasi file.
- Kontrol akses untuk audio ujian.

### 1.3 Course & Learning Modules
Tempat menyusun materi belajar dari tingkat dasar hingga persiapan ujian.

Data dan fitur:
- Course, deskripsi, cover, kategori, dan instruktur.
- Modul, lesson, sublesson, dan urutan pembelajaran.
- Video, audio, PDF, artikel, gambar, worksheet, dan materi interaktif.
- Materi grammar dan kosakata.
- Latihan, kuis, serta tugas.
- Prasyarat antarlesson atau antarmodul.
- Aturan progres dan penyelesaian course.
- Akses gratis, berbayar, privat, atau berdasarkan enrollment.
- Penjadwalan pembukaan materi (drip content).
- Draft, preview, publish, unpublish, dan archive.
- Riwayat revisi materi.

### 1.4 Test & Exam Builder
Modul untuk menyusun soal menjadi latihan, kuis, section test, atau simulasi TOEFL ITP lengkap.

Pengaturan:
- Judul, deskripsi, instruksi, dan cover ujian.
- Pemilihan soal manual atau berdasarkan kriteria.
- Jumlah soal per section.
- Urutan pengerjaan.
- Durasi total atau durasi per section.
- Pengacakan soal dan pilihan jawaban.
- Aturan navigasi, termasuk boleh atau tidaknya kembali ke soal sebelumnya.
- Batas percobaan.
- Jadwal mulai dan berakhir.
- Autosave dan pemulihan sesi jika koneksi terputus.
- Pengaturan kapan pembahasan ditampilkan.
- Passing score dan syarat remedial.
- Pengaturan sertifikat jika digunakan.

### 1.5 Scoring & Results
Modul untuk mengelola penilaian dan laporan hasil peserta.

Fitur:
- Skor Listening, Structure and Written Expression, serta Reading.
- Skor keseluruhan.
- Jumlah jawaban benar dan salah.
- Waktu pengerjaan.
- Riwayat percobaan.
- Analisis performa per topik dan tipe soal.
- Perbandingan hasil antarsimulasi.
- Grafik perkembangan nilai.
- Rekomendasi materi berdasarkan kelemahan.
- Ekspor laporan ke PDF atau Excel.

**Catatan:** TOEFL ITP menggunakan skala skor per section dan total. Jangan mengubah persentase jawaban benar menjadi skor resmi secara langsung. Sediakan `Scoring Profile Manager` agar aturan konversi dapat dikonfigurasi berdasarkan tabel konversi yang sah dan sesuai versi tes. Jika tabel yang sesuai belum tersedia, tampilkan skor mentah atau estimasi dengan label yang jelas.

## 2. Struktur Bank Soal TOEFL ITP

Bank soal sebaiknya mendukung tiga section utama dan tetap dapat diperluas jika ada tipe soal tambahan.

### 2.1 Section 1 — Listening Comprehension
Jenis konten:
- Short Conversations.
- Longer Conversations.
- Talks atau Academic Lectures.
- Main Idea.
- Detail.
- Inference.
- Purpose.
- Meaning in Context.

Sistem harus mendukung satu audio yang dipakai oleh beberapa pertanyaan.

### 2.2 Section 2 — Structure and Written Expression
Jenis konten:
- Incomplete Sentences.
- Error Identification.
- Subject–Verb Agreement.
- Tenses.
- Clauses.
- Pronouns.
- Prepositions.
- Parallel Structure.
- Sentence Completion dan analisis pola kalimat.

### 2.3 Section 3 — Reading Comprehension
Jenis konten:
- Reading Passage dengan beberapa pertanyaan.
- Main Idea.
- Supporting Details.
- Vocabulary in Context.
- Inference.
- Reference.
- Author's Purpose.
- Organization.
- Information Questions.

### 2.4 Field untuk Setiap Soal

| Field | Fungsi |
|---|---|
| Question ID | ID unik setiap soal |
| Section | Listening, Structure, atau Reading |
| Question Type | Jenis pertanyaan |
| Question / Stem | Isi pertanyaan |
| Answer Options | Pilihan jawaban sesuai tipe soal |
| Correct Answer | Kunci jawaban |
| Explanation | Pembahasan jawaban |
| Difficulty | Easy, Medium, atau Hard |
| Topic / Skill | Topik grammar, inference, detail, dan lainnya |
| Media Attachment | Audio, gambar, atau aset pendukung |
| Passage / Audio Group | Relasi ke bacaan atau audio bersama |
| Tags | Label untuk pencarian dan filter |
| Status | Draft, Review, Published, atau Archived |
| Version | Riwayat revisi |
| Source / License | Sumber dan status izin penggunaan |

### 2.5 Question Group
Sediakan fitur `Question Group` untuk menghubungkan beberapa pertanyaan dengan satu materi bersama.

Contoh:
- Satu passage Reading digunakan oleh lima pertanyaan.
- Satu audio percakapan digunakan oleh beberapa pertanyaan Listening.
- Satu talk atau lecture menjadi sumber untuk satu kelompok soal.

Admin cukup mengelola passage atau audio satu kali, kemudian menghubungkannya ke pertanyaan terkait.

### 2.6 Fitur Pengelolaan Bank Soal
- **Rich Text Editor:** format seperti Word, termasuk bold, italic, superscript, subscript, daftar, simbol, tabel, dan paragraf.
- **Bulk Import:** impor dari Excel, CSV, atau template DOCX yang didukung.
- **Bulk Export:** ekspor berdasarkan section, topik, status, atau tingkat kesulitan.
- **Question Preview:** melihat tampilan soal seperti yang dilihat peserta.
- **Duplicate & Reuse:** duplikasi soal atau gunakan kembali soal di beberapa latihan.
- **Review Workflow:** alur Draft → Review → Published dengan persetujuan editor.
- **Version History:** lihat perubahan dan pulihkan versi sebelumnya.
- **Quality Validation:** mendeteksi soal tanpa kunci, opsi kosong, audio rusak, atau passage yang belum terhubung.

## 3. Audio Manager dan Media Library

Audio sebaiknya menjadi modul tersendiri, bukan hanya file yang ditempelkan pada pertanyaan. Dengan begitu, admin dapat mengelola aset audio di satu tempat dan mengetahui semua soal yang menggunakannya.

### 3.1 Audio Manager
- Upload file audio.
- Validasi format, ukuran, durasi, dan status pemrosesan.
- Preview dengan audio player.
- Play/pause, durasi, volume, dan waveform.
- Pengaturan kecepatan pemutaran untuk materi latihan.
- Pengelolaan transkrip.
- Sinkronisasi timestamp jika diperlukan.
- Pengaturan kapan transkrip boleh dilihat peserta.
- Relasi satu audio ke banyak soal.
- Peringatan sebelum mengganti atau menghapus audio yang masih digunakan.
- Kontrol akses audio ujian.

### 3.2 Media Library
Media Library sebaiknya mendukung:
- Audio.
- Gambar dan diagram soal.
- Gambar pendukung passage.
- Video pembelajaran.
- PDF, worksheet, dan materi unduhan.
- Cover course dan thumbnail.
- Caption, subtitle, dan transkrip.
- Metadata hak cipta, sumber, ukuran, format, tanggal upload, dan pemilik.

**Rekomendasi teknis:** simpan file media di object storage. MongoDB menyimpan metadata, storage key atau URL, relasi soal, dan hak akses. Hindari menyimpan file audio besar sebagai Base64 langsung di dokumen soal MongoDB.

Untuk audio ujian, hindari URL publik permanen yang mudah dibagikan. Gunakan akses terkontrol dan signed URL apabila didukung oleh layanan penyimpanan.

## 4. Course Manager

Admin harus dapat menyusun course tanpa bantuan developer.

### 4.1 Struktur Konten
`Course → Learning Modules → Lessons / Sublessons → Activities`

- **Course:** contoh, TOEFL ITP Preparation.
- **Learning Modules:** Listening, Structure, Reading, dan Test Strategy.
- **Lessons:** video, artikel, audio, PDF, atau materi interaktif.
- **Activities:** latihan, kuis, tugas, dan ujian.

### 4.2 Field dan Fitur Course
| Fitur | Detail |
|---|---|
| Course Information | Judul, deskripsi, cover, instruktur, kategori |
| Curriculum Builder | Membuat modul, lesson, sublesson, dan mengatur urutannya |
| Lesson Editor | Rich text, gambar, tabel, video, audio, dan embed |
| Learning Resources | PDF, slide, worksheet, link, dan file unduhan |
| Course Access | Gratis, berbayar, private, atau berdasarkan enrollment |
| Prerequisites | Materi yang harus diselesaikan terlebih dahulu |
| Progress Rules | Persentase penyelesaian, lesson wajib, dan syarat kelulusan |
| Quiz Assignment | Menghubungkan kuis atau ujian ke lesson |
| Drip Content | Mengatur tanggal atau jeda waktu pembukaan materi |
| Course Versioning | Revisi materi tanpa merusak riwayat belajar peserta |
| Publication | Draft, preview, publish, unpublish, dan archive |

### 4.3 Contoh Course
- TOEFL ITP Beginner Preparation.
- Intensive TOEFL ITP 30 Days.
- Listening Mastery.
- Structure and Grammar Mastery.
- Reading Comprehension Mastery.
- Full TOEFL ITP Simulation.

## 5. Test Builder

Test Builder mengambil soal dari Question Bank dan mengemasnya menjadi berbagai jenis aktivitas.

### 5.1 Jenis Tes
- **Practice Set:** latihan singkat berdasarkan topik, misalnya 10 soal Subject–Verb Agreement.
- **Section Test:** simulasi satu bagian, yaitu Listening, Structure, atau Reading.
- **Full Simulation:** ujian lengkap dengan pembagian section dan batas waktu.
- **Diagnostic Test:** tes awal untuk mengetahui kemampuan dan kelemahan peserta.
- **Adaptive Practice:** latihan rekomendasi yang disesuaikan dengan hasil sebelumnya; tidak mengubah format resmi ujian.
- **Custom Test:** admin memilih soal secara manual berdasarkan tag, tingkat kesulitan, dan section.

### 5.2 Pengaturan Ujian
- Judul, deskripsi, instruksi, dan cover.
- Pemilihan soal manual atau berdasarkan kriteria.
- Jumlah soal per section.
- Durasi total atau durasi per section.
- Pengacakan soal dan pilihan jawaban.
- Aturan navigasi soal.
- Batas percobaan dan jadwal ujian.
- Autosave jawaban dan pemulihan sesi.
- Waktu penayangan pembahasan.
- Passing score dan remedial.
- Sertifikat bila diperlukan.

Untuk simulasi yang mendekati TOEFL ITP, jumlah soal, durasi, dan alur section harus mengikuti format yang memang ingin disimulasikan. Jangan menganggap setiap latihan bebas sebagai simulasi resmi.

## 6. Scoring, Results, dan Analytics

Sistem sebaiknya dapat menampilkan:
- Skor Listening, Structure and Written Expression, serta Reading.
- Skor keseluruhan.
- Jumlah jawaban benar dan salah.
- Waktu pengerjaan dan riwayat percobaan.
- Analisis performa per topik dan tipe soal.
- Perbandingan hasil antarsimulasi.
- Grafik perkembangan peserta.
- Daftar materi yang direkomendasikan berdasarkan kelemahan.
- Laporan yang dapat diunduh dalam PDF atau Excel.

Sediakan `Scoring Profile Manager` untuk mengelola aturan konversi skor sesuai tabel konversi yang sah dan sesuai versi tes. Jika belum tersedia, tampilkan skor mentah atau estimasi dengan label yang jelas.

## 7. Modul Administrasi Tambahan

| Modul | Hal yang dikelola |
|---|---|
| User & Enrollment | Akun, profil, pendaftaran course, dan status peserta |
| Instructor Manager | Profil instruktur, course yang ditangani, dan hak akses |
| Pricing & Packages | Paket kursus, harga, masa aktif, dan benefit |
| Payment & Transactions | Pembayaran, status transaksi, riwayat, dan refund jika diperlukan |
| Voucher & Promotion | Kode promo, diskon, periode, dan batas penggunaan |
| Certificate Manager | Template sertifikat, nomor, syarat penerbitan, dan verifikasi |
| Notification Manager | Email pendaftaran, pengingat ujian, hasil tes, dan progres |
| Question Review | Pemeriksaan soal sebelum dipublikasikan |
| Content Versioning | Riwayat perubahan course, soal, dan materi |
| Reports & Analytics | Statistik peserta, nilai, course populer, dan penyelesaian |
| Roles & Permissions | Hak akses superadmin, admin akademik, editor soal, instruktur, dan peserta |
| Audit Logs | Catatan perubahan kunci jawaban, skor, materi, dan transaksi |
| System Settings | Pengaturan email, storage, branding, konfigurasi ujian, dan keamanan |

## 8. Rekomendasi Struktur Sidebar Admin

1. **Overview Dashboard**
2. **Academic Management**
   - Courses
   - Modules
   - Lessons
   - Instructors
3. **Question Management**
   - Question Bank
   - Question Groups
   - Import / Export
   - Review Queue
4. **Media Center**
   - Audio Library
   - Image Library
   - Video Library
   - Documents
5. **Assessment Center**
   - Practice Sets
   - Section Tests
   - Full Simulations
   - Test Schedules
6. **Scoring & Reports**
   - Scoring Profiles
   - Results
   - Analytics
   - Score Reports
7. **Student Management**
   - Students
   - Enrollments
   - Learning Progress
8. **Commerce**
   - Packages
   - Pricing
   - Payments
   - Vouchers
9. **Certificates**
   - Templates
   - Issuance
   - Verification
10. **Communication**
    - Email Templates
    - Notifications
11. **System Administration**
    - Users & Roles
    - Audit Logs
    - Settings

## 9. Fitur Lanjutan untuk Meningkatkan Daya Saing

### 9.1 AI Learning Assistant
Membantu menjelaskan grammar, kosakata, dan pembahasan, serta memberikan rekomendasi latihan berdasarkan hasil peserta. AI tidak boleh mengubah kunci jawaban resmi secara otomatis.

### 9.2 AI Question Authoring Assistant
Membantu editor membuat draf soal, distractor, pembahasan, tag, dan tingkat kesulitan. Semua hasil AI harus ditinjau manusia sebelum dipublikasikan.

### 9.3 Learning Intelligence
Mengidentifikasi topik yang sering salah, perkembangan nilai, dan latihan berikutnya yang relevan untuk peserta.

### 9.4 Exam Integrity
Mendukung autosave, timer yang divalidasi server, pencatatan kejadian selama ujian, serta kontrol akses terhadap soal dan hasil.

## 10. Prioritas Pengembangan

### Tahap 1 — Fondasi Akademik
- Question Bank.
- Question Group.
- Audio Library.
- Passage Manager.
- Course Manager.
- Lesson Editor.
- Media Library.

### Tahap 2 — Sistem Ujian
- Test Builder.
- Timer.
- Autosave.
- Scoring.
- Result History.
- Laporan peserta.

### Tahap 3 — Operasional LMS
- User Management.
- Enrollment.
- Role Permissions.
- Notifikasi email.
- Pembayaran.
- Sertifikat.

### Tahap 4 — Kecerdasan dan Optimasi
- AI Assistant.
- AI Question Authoring.
- Analitik tingkat kesulitan soal.
- Rekomendasi belajar personal.

## 11. Prinsip Arsitektur yang Penting

Pisahkan dengan jelas:
- **Question Bank:** menyimpan soal yang dapat digunakan kembali.
- **Question Group:** menghubungkan beberapa soal dengan satu passage atau audio.
- **Media Library:** menyimpan metadata dan relasi aset media.
- **Course Content:** mengatur materi dan urutan pembelajaran.
- **Test Instance:** merepresentasikan ujian yang dijadwalkan atau dikerjakan peserta.

Ketika ujian dimulai, sistem perlu menyimpan snapshot soal, pilihan, kunci atau versi penilaian yang relevan, dan konfigurasi ujian. Dengan demikian, perubahan soal di masa depan tidak mengubah hasil ujian yang sudah selesai.

Untuk implementasi berbasis React dan MongoDB, struktur ini memberi fondasi yang fleksibel bagi paket berbayar, simulasi berkala, dan fitur AI tanpa harus merombak arsitektur dari awal.

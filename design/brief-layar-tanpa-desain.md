# Brief desain: layar yang belum punya desain

Acuan visual: `English Inspira — Redesign Website.html` (28 layar), logo di `design/brand/`.
Palet: navy `#0A2257`, biru `#0B4FA6`, emas `#D9A02F`; font Poppins; UI berbahasa Inggris; tanpa panah dan em dash.
Aturan semua layar: hanya konten yang menggulung (sidebar/header tetap), tidak ada ruang kosong yang memaksa scroll, responsif 1920 sampai 360 px dan 16:9 sampai 9:16, target sentuh minimal 44 px.

## Prioritas tinggi (dilihat peserta setiap hari)
| Layar | Peran | Isi yang harus ada | Data |
|---|---|---|---|
| Learn: daftar course dan unit | Peserta | Kartu course (status, progres, jumlah unit), kartu unit, rekomendasi dari hasil tes | `/api/courses` |
| Unit/Materi: tampilan belajar | Peserta | Materi rich text/HTML interaktif, audio dengan transkrip, kuis unit, tanda selesai, lanjut ke berikutnya | `/api/units`, `/api/materials` |
| Coaching: booking dengan coach | Peserta | Sisa kuota, slot per tanggal, pesan, batalkan, riwayat kehadiran | `/api/coaching` |
| Panel notifikasi | Semua | Daftar, tandai dibaca, tautan ke sumber | `/api/notifications` |

## Prioritas sedang (alat kerja)
| Layar | Peran | Isi yang harus ada |
|---|---|---|
| Pembangun kurikulum | Admin | Susun course, unit, urutan materi, kuis; pratinjau "lihat sebagai peserta" |
| Editor materi | Admin | Rich text, blok interaktif, audio, status draft/review/terbit, riwayat versi |
| Editor soal dengan audio | Admin | Soal Listening dengan audio dan transkrip, tag skill + topik |
| Perakit tes | Admin | Pilih soal per section, durasi, level |
| Portal Coach | Coach | Peserta, sesi dan kehadiran, jadwal slot, tinjauan Konselor AI |
| Unggah hasil luar | Peserta | Unggah PDF, hasil analisis, status |

## Prioritas rendah
Parameter Sistem, Coaching Monitor, Review Proctoring, halaman pemeliharaan, impor peserta.

## Sudah ada di aplikasi tetapi belum ada di desain asli
Journey 7 tahap (`/journey`), hasil dengan Konselor AI di dalam halaman, kartu course di Learn.
Gunakan sebagai titik awal agar gaya konsisten.

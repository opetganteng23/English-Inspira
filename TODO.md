# TODO Edulyfe EPTA

Legenda status: ✅ Sudah · 🔄 Sedang · ⬜ Belum · ⏭️ Sengaja dilewati (alasan wajib diisi)

Aturan: setiap perubahan (kode, spec, keputusan) dicatat di sini. Update tabel ini di akhir setiap pekerjaan.

## A. Persiapan & Desain

| # | Item | Status | Catatan |
|---|---|---|---|
| A1 | Ekstrak 28 layar dari bundle HTML ke `design/` | ✅ | `design/body/` paling mudah dibaca |
| A2 | Audit desain vs spec | ✅ | Hasil di spec v1.1 bagian 0 |
| A3 | Spec v1.1 (nama Edulyfe EPTA, field user, `prediction`, API tambahan) | ✅ | `english-inspira-master-spec.md` |
| A4 | Ganti teks "English Inspira" di UI | 🔄 | Sudah di login, logo, layout. Sisanya saat tiap layar dibangun |
| A5 | Desain layar tambahan (editor Materi, upload audio, state Listening, mobile, dst.) | ⬜ | Daftar lengkap di spec bagian 0 |

## B. Keputusan default (perlu konfirmasi bisnis)

| # | Keputusan | Status | Catatan |
|---|---|---|---|
| B1 | Login email OTP saja | ✅ | Dipakai |
| B2 | Proctoring ringan tanpa rekaman kamera/mikrofon | ✅ | Kamera di layar 16 & 19 sengaja tidak dibuat |
| B3 | Kuota Konselor AI = jumlah pesan + masa berlaku | ⬜ | Angka pasti belum ditentukan |
| B4 | Notifikasi email saja | ✅ | WhatsApp ditunda |
| B5 | Tabel konversi skor resmi | ⬜ | Sementara pakai konversi linear di `lib/scoring-config.json`, BUKAN skor resmi |

## C. Fase 1 — Fondasi

| # | Item | Status | Catatan |
|---|---|---|---|
| C1 | Scaffold Next.js 14 + Tailwind + token desain | ✅ | `app/` |
| C2 | Koneksi MongoDB (+ fallback in-memory untuk dev) | ✅ | |
| C3 | Model User, Otp, Institution, AuditLog | ✅ | |
| C4 | Mailer Gmail App Password (log ke konsol bila kosong) | ✅ | |
| C5 | OTP: request, verify, lockout 5×, rate limit | ✅ | Diuji manual |
| C6 | Sesi JWT httpOnly, `/api/me`, logout | ✅ | |
| C7 | RBAC `requireRole`, `scopeByInstitution`, middleware rute | ✅ | |
| C8 | Layout peserta/admin/institusi + halaman masuk | ✅ | Halaman isi masih placeholder |
| C9 | Login kata sandi / Google / OTP WhatsApp | ⏭️ | Tidak ada di spec; diputuskan email OTP saja (B1) |
| C10 | Uji otomatis `inst_admin` tidak bisa baca institusi lain | ⬜ | Kriteria penerimaan spec bagian 16 |
| C11 | Rate limit persisten (Mongo/Redis) untuk multi-instance | ⬜ | Sekarang in-memory |

## D. Fase 2 — Bank soal, aset, audio, mesin tes, free trial

| # | Item | Status | Catatan |
|---|---|---|---|
| D1 | Model Asset + `POST/GET /api/assets` (base64, dedup sha256, MIME whitelist, magic bytes) | 🔄 | Kode + build; belum diuji lewat curl. Aset sensitif: hanya pemilik/admin, `no-store` |
| D2 | Kompres gambar di klien (≤300 KB) | 🔄 | `lib/compress-image.ts`, kini dipakai editor Bank Soal; belum diuji di browser |
| D3 | Model Question, QuestionGroup, Test, Attempt | ✅ | Passage digabung ke `QuestionGroup` (passage + audio dalam satu grup) |
| D4 | Upload audio MP3 → GridFS (magic bytes, 15 MB, 10 menit, dedup) | ✅ | Diuji: valid diterima, teks berekstensi .mp3 ditolak, peserta ditolak, duplikat terdeteksi |
| D5 | Stream audio HTTP Range + signed URL 10 menit | ✅ | Diuji: 206 + Content-Range; tanpa token 403 |
| D6 | Audio sekali putar per attempt + lanjut dari posisi terakhir | ✅ | Diuji: putar ulang setelah selesai ditolak 403 |
| D7 | Scoring server-side, konfigurasi konversi | ✅ | Diuji: 20/42 benar → 487 (sesuai hitungan manual). Tabel resmi belum ada (B5) |
| D8 | Mesin tes: start, resume, autosave, advance section, submit idempoten | ✅ | Diuji lewat curl. Soal section lain & setelah submit ditolak; kunci jawaban tidak bocor |
| D8a | Timer server: section kedaluwarsa maju otomatis / auto-submit | 🔄 | Kode ada (`syncTimer`), BELUM diuji karena butuh menunggu waktu habis. Perlu tes otomatis dengan jam palsu |
| D9 | Proctoring ringan: catat `proctorFlags` | ✅ | Klien mengirim tab_hidden/fullscreen_exit/paste; terekam di server. Multi-tab belum dideteksi |
| D10 | Free trial 1× per akun | ✅ | Diuji: trial kedua ditolak 409; 5 pembahasan gratis, sisanya terkunci tanpa membocorkan isi |
| D11 | Seed: tes trial 42 soal | ✅ | `lib/seed.ts` + `POST /api/dev/seed` (dev saja). Soal CONTOH, bukan resmi. Listening tanpa audio kecuali ditempel manual. Akun admin lewat `ADMIN_EMAILS` |
| D12 | UI: Tes Saya, ruang tes, hasil | 🔄 | Lolos typecheck + build; BELUM diuji di browser (timer, navigator, pemutar audio, dialog) |
| D13 | Admin Bank Soal: CRUD soal, grup audio/passage, upload audio, lampiran gambar | 🔄 | API diuji (403 untuk peserta, validasi, sanitasi passage, hapus grup terpakai ditolak). UI lolos typecheck+build, BELUM diuji di browser |
| D14 | Impor Excel soal | ⬜ | Butuh library xlsx |
| D15 | Upload audio via streaming (bukan `formData` penuh di memori) | ⏭️ | Batas 15 MB membuat buffer di memori masih aman; ditinjau ulang jika batas dinaikkan |
| D16 | Persiapan tes: uji perangkat audio sebelum mulai | ⬜ | Layar 16 versi tanpa kamera (B2) |
| D17 | Halaman hasil: target skor dari profil, analisis AI | ⬜ | Target sementara 550 (hard-code di UI); AI di Fase 3 |
| D18 | Entitlement untuk tes selain trial | ⬜ | Sementara hanya trial yang terbuka untuk peserta; admin bisa semua. Fase 4 |
| D19 | Admin: perakit Tes (susun section, durasi, pilih soal published) | ⬜ | PENTING: sekarang tes hanya terbentuk lewat seed; soal baru dari Bank Soal belum bisa dimasukkan ke tes |
| D20 | Bank Soal: pratinjau soal seperti tampilan peserta, duplikasi soal | ⬜ | |
| D21 | Sanitasi passage pakai whitelist `sanitize-html` | ✅ | `lib/sanitize.ts`; gambar hanya `/api/assets/<id>`. Editor rich text (TipTap) di Fase 5 |
| D22 | Peringatan edit soal yang sudah dipakai tes (skor lama berubah) | 🔄 | API mengembalikan `usedInTest` dan mencatat audit; UI belum menampilkan peringatan |

## E. Fase berikutnya

| Fase | Isi | Status |
|---|---|---|
| 3 | AI analisis hasil + Konselor + rencana aksi | ⬜ |
| 4 | Produk, keranjang, voucher, Midtrans, entitlements, Journey | ⬜ |
| 5 | Modul Materi (TipTap, HTML sandbox, progress) | ⬜ |
| 6 | ITP resmi, sertifikat PDF | ⬜ |
| 7 | Admin lengkap + dashboard institusi + laporan | ⬜ |
| 8 | Hardening, uji beban, backup, deploy | ⬜ |

## F. Temuan & perbaikan selama pengerjaan

| Item | Status | Catatan |
|---|---|---|
| Mongoose 9: `FilterQuery` → `QueryFilter` | ✅ | `lib/rbac.ts` |
| `mongodb-memory-server` harus external di Next | ✅ | `next.config.mjs` |
| Field `type` di subdokumen Mongoose dibaca sebagai tipe | ✅ | `proctorFlags` memakai `kind` |
| Server dev lama tertinggal di port 3100 (Windows `pkill` tidak membunuh) | ✅ | Dimatikan via PowerShell; perhatikan saat uji |
| Peringatan ESLint `exhaustive-deps` di ruang tes | ✅ | Dinonaktifkan 1 baris dengan alasan (efek hanya bergantung `left`) |
| `route.ts` Next hanya boleh mengekspor handler HTTP | ✅ | Skema Zod dipindah ke `lib/admin-schemas.ts` |
| Route GET ber-cookie memicu log "Dynamic server usage" saat build | ✅ | `export const dynamic = "force-dynamic"` |

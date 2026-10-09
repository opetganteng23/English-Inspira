# Edulyfe EPTA (English Proficiency Test & Analytics)

Platform persiapan TOEFL ITP untuk institusi mitra: placement test yang menentukan level, tes simulasi dan latihan, analisis AI, Konselor AI, materi interaktif, pendaftaran tes ITP resmi, sertifikat, serta dashboard institusi dan coach. Peserta tidak mendaftar sendiri; akun dibuat lewat undangan institusi (kontrak, kursi, impor CSV/Excel). Satu proyek Next.js: UI di `app/app/`, API di `app/app/api/`.

- Spesifikasi acuan: [English_Inspira_LMS_MTS_V2_2.md](English_Inspira_LMS_MTS_V2_2.md) (v2.2). `english-inspira-master-spec.md` (v1.1) sudah tidak berlaku.
- Status pekerjaan per item (✅/🔄/⬜/⏭️): [TODO.md](TODO.md)
- Desain acuan: `English Inspira — Redesign Website.html` (hasil ekstraksi terbaca ada di `design/body/`)

## Menjalankan di lokal

```bash
cd app
npm install
cp .env.example .env.local        # isi JWT_SECRET minimal; sisanya opsional untuk dev
npm run dev                       # http://localhost:3000
```

Tanpa konfigurasi tambahan, mode dev memakai:

| Komponen | Perilaku bila kunci kosong |
|---|---|
| MongoDB | `mongodb-memory-server` (data hilang saat server berhenti). Isi `MONGODB_URI` untuk Atlas atau MongoDB di VM |
| Email | Kode OTP dan email dicetak ke konsol server |
| Claude API | Analisis dan Konselor berjalan di "mode dasar" berbasis aturan, ditandai jelas di UI |

Isi data awal: `POST /api/dev/seed` (dev, DB in-memory) atau, untuk DB nyata, `npm run seed` (tambah `seed:demo` untuk institusi/jadwal/materi contoh). Soal seed adalah **soal contoh, bukan soal resmi**; ganti lewat menu Bank Soal.

Admin pertama: isi `ADMIN_EMAILS` dengan emailmu, lalu masuk lewat `/masuk`. Akun lain **harus dibuat/diundang** (Admin → Institusi → Tambah peserta, atau Admin → Coach & Admin). Di dev, email undangan beserta tautannya dicetak ke konsol server. Akun demo setelah seed: `coach@demo.local`, `instadmin@demo.local`, `peserta1..3@demo.local` (institusi DEMO2026).

## Pengujian

```bash
npm run typecheck
npm test                           # uji unit (vitest)
# Uji end-to-end (76 pemeriksaan) terhadap server dev dengan DB in-memory:
ADMIN_EMAILS=admin@test.local npm run dev -- -p 3100 > dev.log 2>&1
LOG=dev.log node scripts/smoke.mjs
```

## Deploy

### Target utama: VPS Biznet Gio Cloud + PM2 + Nginx

Contoh untuk Ubuntu 22.04. Ganti `example.com` dan sesuaikan path.

```bash
# 1. Sekali saja di server
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# 2. Ambil kode & build
git clone https://github.com/Kiryzsuuu/Edulyfe-EPTA.git && cd Edulyfe-EPTA/app
cp .env.example .env.local && nano .env.local     # isi nilai production (lihat daftar di bawah)
npm ci && npm run build

# 3. Jalankan dengan PM2 (satu instance, lihat ecosystem.config.cjs) dan hidupkan saat boot
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup                           # jalankan perintah yang dicetak pm2

# 4. Nginx + HTTPS
sudo cp ../deploy/nginx.edulyfe.conf /etc/nginx/sites-available/edulyfe-epta
sudo ln -s /etc/nginx/sites-available/edulyfe-epta /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d example.com
```

Update versi baru: `git pull && npm ci && npm run build && pm2 reload edulyfe-epta`. Cek kesehatan: `curl https://example.com/api/health` dan `pm2 logs edulyfe-epta`.

Hal khusus untuk PM2/Nginx:

- **Satu instance saja.** Rate limit dan penjadwal (`ENABLE_INPROCESS_CRON=true`: antrean email tiap menit, job per jam, job harian 01:00 WIB) berjalan di dalam proses. Jangan pakai mode cluster; kalau nanti perlu scale-out, matikan `ENABLE_INPROCESS_CRON` dan panggil dari cron sistem: `* * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/mail` (juga `/hourly` per jam dan `/daily` harian).
- **Nginx wajib menimpa `X-Forwarded-For` dengan `$remote_addr`** (sudah di contoh), karena rate limit memakai header itu, dan meneruskan `Host`/`X-Forwarded-Host` karena pengecekan Origin (anti-CSRF) membandingkannya.
- `client_max_body_size 20m` untuk unggahan audio (maks 15 MB). Audio dan gambar tersimpan di MongoDB (GridFS/base64), jadi tidak ada folder upload yang perlu dibackup terpisah.
- **MongoDB:** pakai Atlas, atau pasang MongoDB di VM yang sama (hanya `127.0.0.1`, aktifkan autentikasi). Backup harian `mongodump` ke luar VM.
- Firewall: buka hanya 22, 80, 443. Port 3000 dan 27017 jangan terbuka ke publik.

Deploy memakai VPS + PM2 + Nginx (tanpa Docker).

Daftar penting sebelum rilis:

1. Isi `JWT_SECRET`, `FIELD_ENCRYPTION_KEY` (32 byte base64), `MONGODB_URI`, `APP_URL`. **Di production ketiganya wajib; aplikasi menolak jalan tanpa kunci enkripsi.**
2. Isi `ADMIN_EMAILS`, `CRON_SECRET`, `MAIL_*` (Gmail App Password atau SMTP), dan opsional `ANTHROPIC_API_KEY`.
3. Isi Pengaturan (menu Admin → Pengaturan): kontak bantuan, mitra penyelenggara ITP, kebijakan reschedule, retensi dokumen. Tinjau **Parameter Sistem**: rentang level, kuota coaching, dan terutama tabel konversi skor (`score_conversion`) yang sekarang masih linear sementara.
4. Ganti soal contoh dengan soal resmi, unggah audio Listening, dan rakit tes lewat Admin → Bank Soal / Tes.
5. Tinjau halaman hukum (`/syarat`, `/privasi`) bersama konsultan hukum. Isinya draf.
6. Backup MongoDB terjadwal, mis. `mongodump --uri "$MONGODB_URI" --gzip --archive=/backup/epta-$(date +%F).gz` lewat cron harian, atau snapshot Atlas.
7. Gmail dibatasi ±500 email/hari. Cukup untuk OTP dan notifikasi awal; untuk undangan massal institusi gunakan SMTP transaksional lewat variabel `MAIL_*`.

## Struktur singkat

```
app/
├─ app/(public)  masuk (termasuk tautan undangan), persetujuan data, halaman hukum, verifikasi sertifikat
├─ app/(participant)  beranda, tes, hasil, materi, konselor, itp, sertifikat, profil
├─ app/(room)    ruang tes tanpa sidebar
├─ app/(admin)   modul admin     app/(inst)  portal institusi     app/(coach)  halaman coach
├─ app/api       route handler (auth, tes, audio, aset, AI, materi, ITP, admin, inst, coach, cron)
├─ lib/          db, auth, rbac, access (enrollment), config (parameter & level), scoring, placement, participants, mailq, ai, pdf, crypto, sanitize, ...
├─ models/       skema Mongoose
├─ components/   shell responsif, editor rich text, MaterialFrame (iframe sandbox), grafik
├─ scripts/      seed.ts, smoke.mjs        tests/  uji unit
```

## Keamanan (ringkas)

OTP email (hash, 5 percobaan, rate limit) → sesi JWT cookie `httpOnly`; RBAC di setiap handler dan filter institusi di level query; pengecekan Origin untuk mutasi API; NIK terenkripsi AES-256-GCM; akses admin ke dokumen/NIK/ekspor dicatat di audit log; materi HTML berjalan di iframe `sandbox` tanpa `allow-same-origin` dengan CSP ketat; HTML materi/passage disanitasi di server; audio hanya lewat URL bertanda tangan berumur 10 menit dan sekali putar di mode tes; OTP hanya dikirim ke email terdaftar dengan enrollment berlaku.

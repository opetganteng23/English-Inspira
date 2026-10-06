# Edulyfe EPTA (English Proficiency Test & Analytics)

Platform persiapan TOEFL ITP: tes simulasi format ITP, analisis AI per section, Konselor AI, pendaftaran tes ITP resmi, sertifikat, materi interaktif, dan dashboard institusi. Satu proyek Next.js: UI di `app/app/`, API di `app/app/api/`.

- Spesifikasi lengkap: [english-inspira-master-spec.md](english-inspira-master-spec.md) (v1.1)
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
| MongoDB | `mongodb-memory-server` (data hilang saat server berhenti). Isi `MONGODB_URI` untuk Atlas/Docker |
| Email | Kode OTP dan email dicetak ke konsol server |
| Midtrans | Checkout memakai halaman simulasi bayar (hanya non-production) |
| Claude API | Analisis dan Konselor berjalan di "mode dasar" berbasis aturan, ditandai jelas di UI |

Isi data awal: `POST /api/dev/seed` (dev, DB in-memory) atau, untuk DB nyata, `npm run seed` (tambah `seed:demo` untuk institusi/jadwal/materi contoh). Soal seed adalah **soal contoh, bukan soal resmi**; ganti lewat menu Bank Soal.

Admin pertama: isi `ADMIN_EMAILS` dengan emailmu, lalu masuk lewat `/masuk`.

## Pengujian

```bash
npm run typecheck
npm test                           # uji unit (vitest)
# Uji end-to-end (77 pemeriksaan) terhadap server dev dengan DB in-memory:
npm run dev -- -p 3100 > dev.log 2>&1
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

- **Satu instance saja.** Rate limit dan penjadwal pengingat mingguan (`ENABLE_INPROCESS_CRON=true`) berjalan di dalam proses. Jangan pakai mode cluster; kalau nanti perlu scale-out, matikan `ENABLE_INPROCESS_CRON` dan panggil `/api/cron/reminders` dari cron sistem: `0 1 * * 1 curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/reminders`.
- **Nginx wajib menimpa `X-Forwarded-For` dengan `$remote_addr`** (sudah di contoh), karena rate limit memakai header itu, dan meneruskan `Host`/`X-Forwarded-Host` karena pengecekan Origin (anti-CSRF) membandingkannya.
- `client_max_body_size 20m` untuk unggahan audio (maks 15 MB). Audio dan gambar tersimpan di MongoDB (GridFS/base64), jadi tidak ada folder upload yang perlu dibackup terpisah.
- **MongoDB:** pakai Atlas, atau pasang MongoDB di VM yang sama (hanya `127.0.0.1`, aktifkan autentikasi). Backup harian `mongodump` ke luar VM.
- Firewall: buka hanya 22, 80, 443. Port 3000 dan 27017 jangan terbuka ke publik.

### Alternatif

**Docker:** `cp .env.example .env`, isi nilainya, lalu `docker compose up -d --build` (Dockerfile memakai mode standalone). **Vercel:** set semua env; `vercel.json` menjadwalkan pengingat lewat `/api/cron/reminders`.

Daftar penting sebelum rilis:

1. Isi `JWT_SECRET`, `FIELD_ENCRYPTION_KEY` (32 byte base64), `MONGODB_URI`, `APP_URL`. **Di production ketiganya wajib; aplikasi menolak jalan tanpa kunci enkripsi.**
2. Daftarkan webhook Midtrans: `{APP_URL}/api/midtrans/notification` (Settings → Payment → Notification URL).
3. Isi Pengaturan (menu Admin → Pengaturan): kontak bantuan, mitra penyelenggara ITP, kebijakan refund/reschedule, retensi dokumen.
4. Ganti soal contoh dengan soal resmi, unggah audio Listening, dan rakit tes lewat Admin → Bank Soal / Tes.
5. Tinjau halaman hukum (`/syarat`, `/refund`, `/privasi`) bersama konsultan hukum. Isinya draf.
6. Isi tabel konversi skor resmi di `app/lib/scoring-config.json` (sekarang konversi linear sementara).
7. Backup MongoDB terjadwal, mis. `mongodump --uri "$MONGODB_URI" --gzip --archive=/backup/epta-$(date +%F).gz` lewat cron harian, atau snapshot Atlas.
8. Gmail dibatasi ±500 email/hari. Cukup untuk OTP dan notifikasi awal; untuk undangan massal institusi gunakan SMTP transaksional lewat variabel `MAIL_*`.

## Struktur singkat

```
app/
├─ app/(public)  landing, masuk, daftar, halaman hukum, verifikasi sertifikat
├─ app/(participant)  beranda, journey, tes, hasil, materi, konselor, itp, sertifikat, belanja, profil
├─ app/(room)    ruang tes tanpa sidebar
├─ app/(admin)   modul admin     app/(inst)  portal institusi
├─ app/api       route handler (auth, tes, audio, aset, order, AI, materi, ITP, admin, inst, cron)
├─ lib/          db, auth, rbac, scoring, entitlements, pricing, midtrans, ai, pdf, crypto, sanitize, ...
├─ models/       skema Mongoose
├─ components/   shell responsif, editor rich text, MaterialFrame (iframe sandbox), grafik
├─ scripts/      seed.ts, smoke.mjs        tests/  uji unit
```

## Keamanan (ringkas)

OTP email (hash, 5 percobaan, rate limit) → sesi JWT cookie `httpOnly`; RBAC di setiap handler dan filter institusi di level query; pengecekan Origin untuk mutasi API; NIK terenkripsi AES-256-GCM; akses admin ke dokumen/NIK/ekspor dicatat di audit log; materi HTML berjalan di iframe `sandbox` tanpa `allow-same-origin` dengan CSP ketat; HTML materi/passage disanitasi di server; audio hanya lewat URL bertanda tangan berumur 10 menit dan sekali putar di mode tes; webhook Midtrans diverifikasi signature dan nominal, idempoten.

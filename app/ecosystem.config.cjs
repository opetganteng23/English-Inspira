// PM2: jalankan dari folder app/ setelah `npm ci && npm run build`.
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup        (agar hidup lagi setelah reboot)
//
// SATU instance (fork) disengaja: rate limit OTP/pesan dan penjadwal pengingat mingguan berjalan di dalam proses.
// Menjadikannya cluster (instances > 1) akan menggandakan pengingat dan membuat batas rate tidak akurat.
// Jika nanti perlu scale-out: set ENABLE_INPROCESS_CRON=false, jadwalkan /api/cron/{mail,hourly,daily} lewat cron sistem,
// dan pindahkan rate limiter ke penyimpanan bersama (lihat TODO C11).
// Rahasia (JWT_SECRET, MONGODB_URI, dst.) dibaca Next dari .env.local / .env.production.local di folder ini.
module.exports = {
  apps: [
    {
      name: "edulyfe-epta",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4001",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "900M",
      kill_timeout: 10000,
      time: true,
      env_production: { NODE_ENV: "production", ENABLE_INPROCESS_CRON: "true" },
    },
  ],
};

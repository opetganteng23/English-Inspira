#!/usr/bin/env bash
# redeploy-english: tarik kode terbaru dari GitHub, bangun, lalu restart PM2.
# Pakai di server:  redeploy-english        (atau)  bash /var/www/edulyfe-epta/app/deploy/redeploy-english.sh
# Lingkungan:       APP_DIR (default /var/www/edulyfe-epta), PM2_NAME (default edulyfe-epta), BRANCH (default main)
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/edulyfe-epta}"
PM2_NAME="${PM2_NAME:-edulyfe-epta}"
BRANCH="${BRANCH:-main}"
LOCK="/tmp/redeploy-english.lock"

# Cegah dua deploy berjalan bersamaan.
exec 9>"$LOCK"
flock -n 9 || { echo "Deploy lain sedang berjalan. Batal."; exit 1; }

cd "$APP_DIR"
[ -f app/.env.local ] || { echo "app/.env.local tidak ada. Isi dulu konfigurasi production."; exit 1; }
PREV="$(git rev-parse --short HEAD)"
echo "==> Versi sekarang: $PREV"

echo "==> git pull ($BRANCH)"
git fetch --quiet origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"   # menolak bila ada perubahan lokal yang bentrok; tidak menimpa apa pun
NEW="$(git rev-parse --short HEAD)"

cd app
if [ "$PREV" = "$NEW" ] && [ -d .next ] && [ "${FORCE:-0}" != "1" ]; then
  echo "==> Tidak ada perubahan ($NEW). Pakai FORCE=1 untuk build ulang. Restart saja."
else
  echo "==> npm ci"
  npm ci --no-audit --no-fund
  echo "==> next build"
  NODE_OPTIONS=--max-old-space-size=2048 npm run build
fi

echo "==> pm2 restart"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save >/dev/null

echo "==> cek kesehatan"
PORT="$(grep -E '^PORT=' .env.local | cut -d= -f2 || true)"; PORT="${PORT:-4001}"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then echo "OK: aplikasi sehat di port $PORT (versi $NEW, sebelumnya $PREV)"; exit 0; fi
  sleep 2
done
echo "GAGAL: /api/health tidak merespons. Lihat: pm2 logs $PM2_NAME --lines 80"
echo "Rollback manual: cd $APP_DIR && git reset --hard $PREV && cd app && npm ci && npm run build && pm2 restart $PM2_NAME"
exit 1

#!/usr/bin/env bash
# Starter Ever Gauzy og lægger Solselskabet-demoen ind.
# Kræver Docker (Docker Desktop på Windows/Mac) og Node.js 18+.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Laver .env med tilfældige nøgler ..."
  cp env.template .env
  for k in JWT_SECRET EXPRESS_SESSION_SECRET JWT_REFRESH_TOKEN_SECRET JWT_VERIFICATION_TOKEN_SECRET; do
    v=$(openssl rand -hex 32 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
    sed -i.bak "s|^$k=.*|$k=$v|" .env
  done
  sed -i.bak 's|^APP_NAME=.*|APP_NAME="Coop × Solselskabet"|' .env
  rm -f .env.bak
fi

docker compose up -d

echo "Venter på at API'et er klar (første start tager 3-6 minutter, fordi databasen bygges) ..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then break; fi
  sleep 10
done
curl -sf http://localhost:3000/api/health >/dev/null || { echo "API'et svarer ikke. Se: docker compose logs api"; exit 1; }

node seed/seed.mjs

IP=$( (hostname -I 2>/dev/null | awk '{print $1}') || true)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en0 2>/dev/null || true)
[ -z "$IP" ] && IP="<pc-ens-ip>"

echo
echo "Kontor (pc):     http://localhost:4200   –  admin@ever.co / admin"
echo "                 Vælg organisationen 'Coop × Solselskabet' øverst til højre."
echo "Feltapp (mobil): http://$IP:8080         –  telefonen skal være på samme netværk"
echo "                 montoer@solselskabet.demo / Montoer2026!"
echo "                 service@solselskabet.demo / Service2026!"

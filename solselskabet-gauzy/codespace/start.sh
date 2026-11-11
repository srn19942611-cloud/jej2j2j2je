#!/usr/bin/env bash
# Starter hele løsningen i GitHub Codespaces (eller lokalt med OFFENTLIG_URL=http://localhost:8080).
# Køres automatisk når codespacet starter. Første gang tager det 10–15 minutter.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${OFFENTLIG_URL:-https://${CODESPACE_NAME}-8080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}}"
COMPOSE=(docker compose -p solselskabet -f docker-compose.yml -f online/docker-compose.online.yml -f codespace/docker-compose.codespace.yml)
INFO=codespace/ADGANGSKODER.txt
tilfaeldig() { openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16; }
saet() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
hent() { grep "^$1=" .env | head -1 | cut -d= -f2-; }

echo "▸ Venter på Docker"
for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done

if [ ! -f .env ]; then
	cp env.template .env
	for k in JWT_SECRET EXPRESS_SESSION_SECRET JWT_REFRESH_TOKEN_SECRET JWT_VERIFICATION_TOKEN_SECRET; do saet "$k" "$(openssl rand -hex 32)"; done
	for k in DEMO_SUPER_ADMIN_PASSWORD DEMO_ADMIN_PASSWORD DEMO_EMPLOYEE_PASSWORD MONTOER_ADGANGSKODE SERVICE_ADGANGSKODE; do saet "$k" "$(tilfaeldig)"; done
fi
saet DOMAENE ":8080"
saet APP_NAME '"Coop × Solselskabet"'
saet DEMO false
saet APP_USER_REGISTRATION false
saet ALLOW_TENANTS_REGISTRATION false
saet API_BASE_URL "$URL"
saet CLIENT_BASE_URL "$URL"
saet ALLOWED_ORIGINS "$URL"
saet TRUST_PROXY 1

echo "▸ Bygger og starter (første gang 10–15 minutter)"
"${COMPOSE[@]}" up -d --build
echo "▸ Venter på Gauzy"
for i in $(seq 1 90); do
	"${COMPOSE[@]}" exec -T api node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null && break
	sleep 10
done

echo "▸ Lægger Solselskabet-data ind (springes over hvis det allerede findes)"
docker run --rm --network solselskabet_overlay -v "$PWD":/w -w /w \
	-e GAUZY_API=http://api:3000/api -e GAUZY_EMAIL=admin@ever.co -e GAUZY_PASSWORD="$(hent DEMO_SUPER_ADMIN_PASSWORD)" \
	-e MONTOER_ADGANGSKODE="$(hent MONTOER_ADGANGSKODE)" -e SERVICE_ADGANGSKODE="$(hent SERVICE_ADGANGSKODE)" \
	mirror.gcr.io/library/node:22-alpine node seed/seed.mjs
"${COMPOSE[@]}" exec -T db psql -U postgres -d gauzy -q -v ON_ERROR_STOP=1 < dansk/data.sql

# Gør adressen offentlig, så den kan åbnes uden GitHub-login (fx på telefonen)
if [ -n "${CODESPACE_NAME:-}" ]; then
	gh codespace ports visibility 8080:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
		|| echo "  (Gør port 8080 offentlig manuelt: fanen PORTS → højreklik → Port Visibility → Public)"
fi

cat > "$INFO" <<EOT
Solselskabet-demo – adgang

Kontor (Gauzy):    $URL
  admin@ever.co               $(hent DEMO_SUPER_ADMIN_PASSWORD)

Feltapp (telefon): $URL/felt/
  montoer@solselskabet.demo   $(hent MONTOER_ADGANGSKODE)
  service@solselskabet.demo   $(hent SERVICE_ADGANGSKODE)

Tilbud lokation 3: $URL/felt/#tilbud/3
EOT
echo; cat "$INFO"
echo "(Gemt i solselskabet-gauzy/$INFO)"

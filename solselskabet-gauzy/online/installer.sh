#!/usr/bin/env bash
# Installerer Coop × Solselskabet (Gauzy på dansk + feltapp) på en ny Ubuntu-server.
#
#   sudo ./online/installer.sh gauzy.ditdomæne.dk
#
# Køres fra mappen solselskabet-gauzy. Kan køres igen: eksisterende .env, data og
# adgangskoder bevares.
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAENE="${1:-}"
if [ -z "$DOMAENE" ]; then
	echo "Brug: sudo ./online/installer.sh <domæne>   fx  sudo ./online/installer.sh gauzy.firma.dk"
	exit 1
fi
[ "$(id -u)" -eq 0 ] || { echo "Kør med sudo."; exit 1; }

COMPOSE=(docker compose -p solselskabet -f docker-compose.yml -f online/docker-compose.online.yml)
ADGANGSKODER=/root/solselskabet-adgangskoder.txt
tilfaeldig() { openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20; }
saet() { # saet NØGLE VÆRDI  – sætter/erstatter en linje i .env
	if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

echo "▸ 1/7 Tjekker at $DOMAENE peger på denne server"
SERVER_IP=$(curl -fsS4 https://api.ipify.org || true)
DNS_IP=$(getent ahostsv4 "$DOMAENE" | awk 'NR==1{print $1}' || true)
if [ "$DOMAENE" != "localhost" ] && [ "$SERVER_IP" != "$DNS_IP" ]; then
	echo "  ADVARSEL: $DOMAENE peger på '${DNS_IP:-ingenting}', men serveren har IP $SERVER_IP."
	echo "  Opret en A-record hos din domæneudbyder: $DOMAENE → $SERVER_IP, og vent et par minutter."
	read -r -p "  Fortsæt alligevel? [j/N] " svar
	[ "$svar" = "j" ] || exit 1
fi

echo "▸ 2/7 Installerer Docker (hvis det mangler)"
if ! command -v docker >/dev/null; then
	curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null

echo "▸ 3/7 Firewall: kun SSH, HTTP og HTTPS"
if command -v ufw >/dev/null; then
	ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
	ufw --force enable >/dev/null
fi

echo "▸ 4/7 Konfiguration (.env)"
if [ ! -f .env ]; then
	cp env.template .env
	for k in JWT_SECRET EXPRESS_SESSION_SECRET JWT_REFRESH_TOKEN_SECRET JWT_VERIFICATION_TOKEN_SECRET; do
		saet "$k" "$(openssl rand -hex 32)"
	done
	# Gauzys standardbrugere får lange tilfældige adgangskoder (ellers nægter Gauzy at starte)
	saet DEMO_SUPER_ADMIN_PASSWORD "$(tilfaeldig)"
	saet DEMO_ADMIN_PASSWORD "$(tilfaeldig)"
	saet DEMO_EMPLOYEE_PASSWORD "$(tilfaeldig)"
	saet MONTOER_ADGANGSKODE "$(tilfaeldig)"
	saet SERVICE_ADGANGSKODE "$(tilfaeldig)"
fi
saet DOMAENE "$DOMAENE"
saet APP_NAME '"Coop × Solselskabet"'
saet DEMO false
saet APP_USER_REGISTRATION false         # ingen kan selv oprette sig
saet ALLOW_TENANTS_REGISTRATION false
saet API_BASE_URL "https://$DOMAENE"
saet CLIENT_BASE_URL "https://$DOMAENE"
saet ALLOWED_ORIGINS "https://$DOMAENE"
saet TRUST_PROXY 1                       # Caddy står foran
# AI (valgfrit): angiv nøgler ved kørsel, fx  ANTHROPIC_API_KEY=sk-ant-... MISTRAL_API_KEY=... sudo -E ./online/installer.sh domæne
# Nøglerne kan også lægges ind senere i Gauzy under Indstillinger → AI.
for k in ANTHROPIC_API_KEY OPENAI_API_KEY MISTRAL_API_KEY; do
	[ -n "${!k:-}" ] && saet "$k" "${!k}"
done
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
	saet GAUZY_AI_CHAT_DEFAULT_PROVIDER anthropic
	saet GAUZY_AI_CHAT_DEFAULT_MODEL claude-sonnet-5
fi
chmod 600 .env

echo "▸ 5/7 Bygger og starter (første gang 5–10 minutter)"
"${COMPOSE[@]}" up -d --build
echo "  Venter på at Gauzy er klar ..."
for i in $(seq 1 90); do
	if "${COMPOSE[@]}" exec -T api node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then break; fi
	sleep 10
done

echo "▸ 6/7 Lægger Solselskabet-data ind"
hent() { grep "^$1=" .env | head -1 | cut -d= -f2-; }
DEMO_SUPER_ADMIN_PASSWORD=$(hent DEMO_SUPER_ADMIN_PASSWORD)
MONTOER_ADGANGSKODE=$(hent MONTOER_ADGANGSKODE)
SERVICE_ADGANGSKODE=$(hent SERVICE_ADGANGSKODE)
docker run --rm --network solselskabet_overlay -v "$PWD":/w -w /w \
	-e GAUZY_API=http://api:3000/api -e GAUZY_EMAIL=admin@ever.co -e GAUZY_PASSWORD="$DEMO_SUPER_ADMIN_PASSWORD" \
	-e MONTOER_ADGANGSKODE="$MONTOER_ADGANGSKODE" -e SERVICE_ADGANGSKODE="$SERVICE_ADGANGSKODE" \
	mirror.gcr.io/library/node:22-alpine node seed/seed.mjs
"${COMPOSE[@]}" exec -T db psql -U postgres -d gauzy -q -v ON_ERROR_STOP=1 < dansk/data.sql

echo "▸ 7/7 Natlig backup kl. 02:30 (database + fotos, gemmes 14 dage i /var/backups/solselskabet)"
install -m 755 online/backup.sh /usr/local/bin/solselskabet-backup
echo "30 2 * * * root SOLSELSKABET_DIR=$PWD /usr/local/bin/solselskabet-backup >> /var/log/solselskabet-backup.log 2>&1" > /etc/cron.d/solselskabet-backup

cat > "$ADGANGSKODER" <<EOT
Coop × Solselskabet – adgang (oprettet $(date '+%d.%m.%Y %H:%M'))

Kontor (Gauzy):  https://$DOMAENE
  admin@ever.co               $DEMO_SUPER_ADMIN_PASSWORD

Feltapp (telefon): https://$DOMAENE/felt/
  montoer@solselskabet.demo   $MONTOER_ADGANGSKODE
  service@solselskabet.demo   $SERVICE_ADGANGSKODE

Skift gerne admin-adgangskoden under Profil, og opret rigtige brugere under Medarbejdere.
EOT
chmod 600 "$ADGANGSKODER"

echo
echo "Færdig ✓"
cat "$ADGANGSKODER"
echo
echo "(Adgangskoderne er gemt i $ADGANGSKODER – kun root kan læse filen.)"
# QR-kode til feltappen, så den kan scannes med telefonen
command -v qrencode >/dev/null || apt-get install -y -qq qrencode >/dev/null 2>&1 || true
if command -v qrencode >/dev/null; then
	echo; echo "Scan med telefonen for at åbne feltappen:"
	qrencode -t ANSIUTF8 "https://$DOMAENE/felt/"
fi

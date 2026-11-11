#!/usr/bin/env bash
# Natlig backup af database og fotos. Installeres af installer.sh som cron-job.
# Gendan: se online/README.md
set -euo pipefail
DIR="${SOLSELSKABET_DIR:?}"
MAL=/var/backups/solselskabet
STEMPEL=$(date +%Y-%m-%d_%H%M)
mkdir -p "$MAL"
cd "$DIR"
COMPOSE=(docker compose -p solselskabet -f docker-compose.yml -f online/docker-compose.online.yml)

"${COMPOSE[@]}" exec -T db pg_dump -U postgres -d gauzy -Fc > "$MAL/database_$STEMPEL.dump"
docker run --rm -v solselskabet_uploads:/data:ro -v "$MAL":/backup mirror.gcr.io/library/alpine:3.20 \
	tar czf "/backup/fotos_$STEMPEL.tar.gz" -C /data .

find "$MAL" -type f -mtime +14 -delete
echo "$(date '+%F %T') backup ok: $(du -sh "$MAL" | cut -f1) i alt"

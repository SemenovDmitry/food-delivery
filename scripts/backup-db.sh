#!/usr/bin/env bash
# Бэкап Postgres (этап 11, Q12, GLOSSARY «Fresh-migrate»-сосед): выполняется НА
# ХОСТЕ через docker CLI. Формат — plain SQL + gzip (читаемый глазами,
# восстановление через psql без pg_restore). Расписаний НЕТ — cron в §9
# («автоматические бэкапы по расписанию»). MinIO (картинки) НЕ бэкапится.
#
# Использование:
#   scripts/backup-db.sh                          # prod-стек (по умолчанию)
#   COMPOSE_FILE=docker-compose.dev.yml scripts/backup-db.sh   # dev-стек
#
# Восстановление (подробнее — README «Бэкап и восстановление»):
#   gunzip -c backups/food-<timestamp>.sql.gz | \
#     docker compose -f <compose> exec -T postgres psql -U postgres -d food_delivery \
#       -c "DROP SCHEMA public CASCADE" -c "CREATE SCHEMA public" \
#   # затем повторно с телом дампа (см. README)
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_NAME="food_delivery"
DB_USER="postgres"

mkdir -p backups
OUT="backups/food-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT"
echo "Бэкап готов: $OUT ($(du -h "$OUT" | cut -f1))"

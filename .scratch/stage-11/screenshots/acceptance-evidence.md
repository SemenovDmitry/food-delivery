# Приёмка этапа 11 (тикет 05) — терминальные доказательства, 2026-11-18

## 1. Полный цикл сборки

- `pnpm lint` — чисто; `tsc --noEmit` ×2 (root + ws-gateway) — зелёные; `pnpm build` — ✓ (33/33 страниц, /api/health = ƒ Dynamic); `docker build` — ✓ (warning SecretsUsedInArgOrEnv от AUTH_SECRET_BUILD_FALLBACK — осознанный плейсхолдер этапа 5).

## 2. Throwaway `-p stage11check` — fresh-migrate на пустых volume'ах

- `docker compose -p stage11check -f docker-compose.prod.yml up -d --build` (свои volume'ы `stage11check_*`, общие не тронуты — §5.26).
- Логи app: `[migrate] миграции применены` → Next Ready. `drizzle.__drizzle_migrations` = **7** (все миграции 0–9), tables public = **20**.
- **Idempotent-restart**: `docker restart app` → `[migrate] миграции применены` повторно молча → health 200.
- Health на fresh-volume: `{"status":"error","checks":{"db":"ok","s3":"error: UnknownError"}}` = 503 — **корректный сигнал**: бакет `food-delivery` создаёт сидер, свежий volume его не имеет (см. README «после восстановления — db:seed»).
- Грабли приёмки (см. Comments тикета 05): drizzle-orm/postgres инлайнились в бандл → `serverExternalPackages`; nft копирует `.pnpm`-store без root-симлинка drizzle-orm → ручной `ln -s` в Dockerfile + проверка резолва на build; §5.28 (up -d без --build поднимает старый образ compose).

## 3. env-typo — `docker run` (compose `${VAR:?}`-гвард не участвует)

КЕЙС 1 — только DATABASE_URL (секретов нет):

```
exit=1
[env] конфигурация невалидна (strict, prod-runtime): AUTH_SECRET: Invalid input: expected string, received undefined; INTERNAL_API_SECRET: …; PAYMENTS_WEBHOOK_SECRET: …; S3_ENDPOINT: …; S3_KEY: …; S3_SECRET: …; S3_BUCKET: …; BETTER_AUTH_URL: …
```
КЕЙС 2 — PAYMENT_WINDOW_MINUTES=banana:

```
exit=1
…PAYMENT_WINDOW_MINUTES: Invalid input: expected number, received NaN
```
Примечание: migrate.mjs имеет СВОЙ fail-fast (DATABASE_URL не задан → exit 1 раньше env-схемы) — корректная слоёность.

## 4. Restore-тест

- `COMPOSE_FILE=docker-compose.dev.yml bash scripts/backup-db.sh` → `backups/food-20261118-130136.sql.gz` (20K).
- Throwaway `postgres:17-alpine` (без published-портов) → DROP/CREATE SCHEMA → gunzip | psql: **0 ошибок импорта**; counts: products **25** (24 сидера + тест-сет этапа 7), users **5**, orders **21** — живые данные dev-стека.

## 5. Prod-стек (основной, `up -d --build`)

- `docker ps` — **healthy ×4**: app (Dockerfile HEALTHCHECK), minio (compose: curl→wget фолбэк — сработал на bitnamilegacy), ws-gateway (свой GET /health + wget), postgres (pg_isready).
- `GET /api/health` → `{"status":"ok","checks":{"db":"ok","s3":"ok"}}` 200 + `no-store`.
- Заголовки на `/`: X-Content-Type-Options nosniff · X-Frame-Options DENY · Referrer-Policy strict-origin-when-cross-origin · Permissions-Policy camera=(), microphone=(), geolocation=() · x-request-id (uuid).
- Деградация: `docker stop minio` → `{"status":"error","checks":{"db":"ok","s3":"error: Request aborted"}}` 503 (AbortSignal.timeout 2 с) + **warn в error_events с requestId** (`b4752957-… | error: Request aborted`) → `start` → 200.
- Логи app — JSON: `{"level":30,…,"service":"food-delivery","env":"production","component":"flusher",…,"msg":"аутбокс: флушер стартовал"}`, `"component":"autostatus",…,"advance":false` (**prod off — канон этапа 10**). Gateway — свой JSON (`service":"ws-gateway"`), `wget /health` → `ok`.
- Idempotent-restart: restart app → миграции молча → health 200.
- Лайт-регрессия: `/` 200, `/api/promotions` 200 (COMBO150 в DTO), гость на `/admin` → 307 `/login`.

## 6. Возврат dev (§5.26)

- `docker compose -f docker-compose.dev.yml up -d` → dev-стек (postgres/minio/mailpit healthy); prod app/gateway остановлены (`compose stop` — осиротели без своего postgres); dev-БД целa (products=25).

# 05: Приёмка этапа 11 — полный цикл + throwaway + env-typo + restore + prod

**What to build:** Не код — приёмка (Q13/Q14). Последовательность:

1. **Сборка**: `pnpm lint` → `tsc --noEmit` ×2 (root + ws-gateway) → `pnpm build` (заодно проверяет NEXT_PHASE-lenient env) → `docker build`.
2. **Throwaway-проект** (ДО подъёма основного prod — порты 3000/3001 свободны): `AUTH_SECRET=x INTERNAL_API_SECRET=y PAYMENTS_WEBHOOK_SECRET=z docker compose -p stage11check -f docker-compose.prod.yml up -d --build` → volume'ы с префиксом `stage11check_*`, общие `food-postgres-data`/`food-minio-data` НЕ тронуты (§5.26) → **Fresh-migrate**: таблицы + `__drizzle_migrations` созданы entrypoint'ом автоматически, `/api/health` на :3000 → 200 → `docker compose -p stage11check down -v`.
3. **Env-опечатка через `docker run`, НЕ compose** (`${VAR:?}`-гвард compose отрежет раньше — проверяем НАШ zod): `docker run --rm -e DATABASE_URL=… <app-image>` (без секретов) → exit(1) на старте с читаемым zod-списком (INTERNAL_API_SECRET/AUTH_SECRET/PAYMENTS_WEBHOOK_SECRET); второй прогон `PAYMENT_WINDOW_MINUTES=banana` → exit(1) с ошибкой coercion.
4. **Restore-тест бэкапа**: `scripts/backup-db.sh` против основного volume (prod ещё не поднят — против dev-компоуза: скрипт с `-f docker-compose.dev.yml`, на хосте) → throwaway-postgres (`docker run -d --name stage11-pg -e POSTGRES_PASSWORD=postgres postgres:17-alpine`, без published-портов) → `DROP SCHEMA public CASCADE` → `gunzip | psql -f` → counts: `products=24`, `users ≥ 3` → `docker rm -f stage11-pg`.
5. **Prod-приёмка основного стека** (`up -d --build`): `docker ps` — healthy у app/gateway/postgres/minio; `curl -i /api/health` → 200 + no-store; `docker stop <minio>` → health 503 + `logger.warn` + строка в `error_events` (с requestId — проверка sink) + app unhealthy ≤ ~90 с → `start` → 200; `curl -I /` → 4 security-заголовка + `X-Request-Id`; `docker logs app` — JSON (`service`, `component`, `requestId`); свип/флушер-логи JSON; миграции idempotent-restart: `docker restart <app>` → миграции проходят повторно молча, сервер стартует.
6. **Возврат dev** (§5.26): `docker compose -f docker-compose.dev.yml up -d`; финально lint/tsc×2/build зелёные; AGENTS §3/§6 — чекбоксы `[x]`, «Этап 11 ЗАВЕРШЁН», §8 — роутов 8; коммит этапа (пуш — по явной просьбе).

**Blocked by:** 01, 02, 03, 04

**Status:** resolved

- [x] Полный цикл сборки зелёный (lint / tsc×2 / build / docker build)
- [x] Fresh-migrate на throwaway `-p stage11check`: entrypoint применил миграции на пустом volume (`[migrate] миграции применены`, `drizzle.__drizzle_migrations`=7, tables=20), общие volume'ы целы; idempotent-restart — миграции молча; down -v
- [x] Env-typo (docker run): без секретов → exit(1) с читаемым списком 8 полей; `PAYMENT_WINDOW_MINUTES=banana` → exit(1) `expected number, received NaN`
- [x] Restore-тест: бэкап (20K) → throwaway-postgres → 0 ошибок импорта → counts верны (products=25=24+тест-сет этапа 7, users=5, orders=21 — живые dev-данные); контейнер снесён
- [x] Prod: healthy ×4 (minio curl→wget фолбэк сработал на bitnamilegacy), health 200 / 503-деградация (`Request aborted`) + warn + error_events(requestId b4752957…), 4 заголовка + X-Request-Id, JSON-логи (`advance:false` — prod off — канон этапа 10), idempotent-restart миграций
- [x] Возврат dev (prod app/gateway остановлены — осиротели без своего postgres); доказательства — `.scratch/stage-11/screenshots/acceptance-evidence.md`; AGENTS §3/§6/§8; коммит этапа

## Comments

- 2026-11-18 (приёмка): **ГЛАВНАЯ ГРАБЛЯ ЭТАПА — file-tracing standalone (дополняет Q11/§5.33-семью)**. Standalone бандлит все не-external пакеты в server-чанки: `/app/node_modules` содержит ТОЛЬКО external-пакеты — drizzle-orm/postgres там НЕ БЫЛО → `migrate.mjs` падал ERR_MODULE_NOT_FOUND; force-trace через instrumentation не спасает (nft скопировал `.pnpm`-store, но root-симлинк drizzle-orm не создал; postgres — создал). **Фикс**: `serverExternalPackages += ['drizzle-orm','postgres']` (external → попадают в node_modules) + ручной `ln -s .pnpm/drizzle-orm@*/node_modules/drizzle-orm` в Dockerfile (glob расширяется от CWD — только из `cd node_modules`!) + проверка резолва `node --input-type=module -e "await import('drizzle-orm/postgres-js/migrator')"` прямо на build (упадёт → образ не соберётся, вместо restart-loop контейнера).
- §5.28 снова подтвердился: `up -d` без `--build` поднял старый образ compose — env-фикс «не сработал» до пересборки; правило — always `--build` после правок.
- Health на fresh-volume честно 503 (`s3: UnknownError`): бакет `food-delivery` создаёт СИДЕР, не миграция — свежий деплой требует seed (задокументировано в README-restore); миграции health не проверяет — их провал = контейнер не стартует (migrate-fail-fast).
- Порядок CMD `migrate → server` даёт слоёный fail-fast: migrate требует DATABASE_URL (exit 1 с своим сообщением), env-схема требует остальное — каждый слой роняет со своей читаемой ошибкой.
- Минус-наблюдение: первый psql-запрос миграций обогнал entrypoint (relation not found, через секунду таблица с 7 строками); верифицировать миграции ПОСЛЕ Ready в логах, не сразу после `up`.

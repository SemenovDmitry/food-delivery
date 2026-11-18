# 05: Приёмка этапа 11 — полный цикл + throwaway + env-typo + restore + prod

**What to build:** Не код — приёмка (Q13/Q14). Последовательность:

1. **Сборка**: `pnpm lint` → `tsc --noEmit` ×2 (root + ws-gateway) → `pnpm build` (заодно проверяет NEXT_PHASE-lenient env) → `docker build`.
2. **Throwaway-проект** (ДО подъёма основного prod — порты 3000/3001 свободны): `AUTH_SECRET=x INTERNAL_API_SECRET=y PAYMENTS_WEBHOOK_SECRET=z docker compose -p stage11check -f docker-compose.prod.yml up -d --build` → volume'ы с префиксом `stage11check_*`, общие `food-postgres-data`/`food-minio-data` НЕ тронуты (§5.26) → **Fresh-migrate**: таблицы + `__drizzle_migrations` созданы entrypoint'ом автоматически, `/api/health` на :3000 → 200 → `docker compose -p stage11check down -v`.
3. **Env-опечатка через `docker run`, НЕ compose** (`${VAR:?}`-гвард compose отрежет раньше — проверяем НАШ zod): `docker run --rm -e DATABASE_URL=… <app-image>` (без секретов) → exit(1) на старте с читаемым zod-списком (INTERNAL_API_SECRET/AUTH_SECRET/PAYMENTS_WEBHOOK_SECRET); второй прогон `PAYMENT_WINDOW_MINUTES=banana` → exit(1) с ошибкой coercion.
4. **Restore-тест бэкапа**: `scripts/backup-db.sh` против основного volume (prod ещё не поднят — против dev-компоуза: скрипт с `-f docker-compose.dev.yml`, на хосте) → throwaway-postgres (`docker run -d --name stage11-pg -e POSTGRES_PASSWORD=postgres postgres:17-alpine`, без published-портов) → `DROP SCHEMA public CASCADE` → `gunzip | psql -f` → counts: `products=24`, `users ≥ 3` → `docker rm -f stage11-pg`.
5. **Prod-приёмка основного стека** (`up -d --build`): `docker ps` — healthy у app/gateway/postgres/minio; `curl -i /api/health` → 200 + no-store; `docker stop <minio>` → health 503 + `logger.warn` + строка в `error_events` (с requestId — проверка sink) + app unhealthy ≤ ~90 с → `start` → 200; `curl -I /` → 4 security-заголовка + `X-Request-Id`; `docker logs app` — JSON (`service`, `component`, `requestId`); свип/флушер-логи JSON; миграции idempotent-restart: `docker restart <app>` → миграции проходят повторно молча, сервер стартует.
6. **Возврат dev** (§5.26): `docker compose -f docker-compose.dev.yml up -d`; финально lint/tsc×2/build зелёные; AGENTS §3/§6 — чекбоксы `[x]`, «Этап 11 ЗАВЕРШЁН», §8 — роутов 8; коммит этапа (пуш — по явной просьбе).

**Blocked by:** 01, 02, 03, 04

**Status:** open

- [ ] Полный цикл сборки зелёный (lint / tsc×2 / build / docker build)
- [ ] Fresh-migrate на throwaway `-p stage11check`: entrypoint применил миграции на пустом volume, health 200, общие volume'ы целы; down -v
- [ ] Env-typo (docker run): без секретов → exit(1) с читаемым списком; `PAYMENT_WINDOW_MINUTES=banana` → exit(1)
- [ ] Restore-тест: бэкап → throwaway-postgres → counts верны; контейнер снесён
- [ ] Prod: healthy ×4, health 200/503-деградация + warn + error_events(requestId), заголовки + X-Request-Id, JSON-логи, idempotent-restart миграций
- [ ] Возврат dev; скриншоты/логи в `.scratch/stage-11/screenshots/`; AGENTS §3/§6/§8; коммит этапа

## Comments

-

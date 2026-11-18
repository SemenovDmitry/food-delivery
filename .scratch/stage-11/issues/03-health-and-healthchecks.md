# 03: GET /api/health + карта healthchecks (Dockerfile, compose, gateway /health)

**What to build:** **`GET /api/health`** (Q4, Route Handler №8 — §8 AGENTS обновить): параллельно две проверки — DB `SELECT 1` (drizzle `sql`) и MinIO `HeadBucketCommand` (Bucket из env) — каждая под `AbortSignal.timeout(2000)` (health не имеет права висеть); ответ `200|503`, `Cache-Control: no-store`, JSON `{ status: 'ok'|'error', checks: { db: 'ok'|'error: …', s3: … } }` (в текстах ошибок — короткое message без секретов). MinIO лежит → 503 — health = строгий сигнал «инфраструктура цела», не UX-индикатор. Миграции health НЕ проверяет (их провал валит контейнер на старте — тикет 04). При деградации — `logger.warn({ checks }, 'health: деградация')` (Q13 → строка в error_events — естественный путь проверки sink). **HEALTHCHECK в Dockerfile** (Q5-а): `HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1` (busybox wget в alpine есть, curl не ставим; start-period покрывает migrate + старт сервера; 503 → wget фейлится → unhealthy). В prod-compose НЕ дублируется (наследуется). **Compose-healthchecks** (Q5-б,в): minio — приоритет `curl -f http://localhost:9000/minio/health/live`, содержимое bitnamilegacy-образа (`which curl wget mc`) проверить эмпирически на первом `up`, фолбэк — TCP через bash `/dev/tcp`; ws-gateway — **расширение скоупа**: HTTP-хендлер `GET /health → 200` на его же сервере (upgrade уже живёт на нём, ~10 строк) + compose-healthcheck `wget -q --spider http://127.0.0.1:${PORT:-3001}/health`; postgres — не трогаем (pg_isready есть). **Q15**: `depends_on: app: service_healthy` у шлюза НЕ добавлять (связь ленточная; app unhealthy при лежащем MinIO не должен останавливать шлюз).

**Blocked by:** 02

**Status:** resolved

- [x] `GET /api/health`: SELECT 1 + headBucket, timeout 2 c, 200|503 + {status, checks}, no-store, warn при деградации (+ requestId в warn — путь проверки sink)
- [x] Dockerfile HEALTHCHECK (wget --spider, interval 30s / timeout 5s / start-period 20s / retries 3)
- [x] compose: minio healthcheck (curl health/live, фолбэк wget — эмпирика на приёмке 05), ws-gateway /health + wget-чек
- [x] ws-gateway: HTTP GET /health → 200 на его сервере
- [x] curl живьём (dev): 200 на здоровом стеке; docker down → 503 (sink корректно МОЛЧИТ — INSERT фейлится при лежащей БД); stop minio → 503 + warn → строка в error_events (requestId + checks); start → 200
- [ ] §8 AGENTS — роутов стало 8 (поправить при приёмке, тикет 05)
- [x] lint + `tsc --noEmit` ×2 зелёные

## Comments

- 2026-11-18 (реализация): `connection()` в начале GET — роут динамический (ƒ в build-манкifest), иначе пререндер заморозил бы ответ и дёргал БД на сборке.
- **shortError — трёхступенчатый** (найдено на живой деградации): у S3-сетевых ошибок message пуст (AggregateError с под-ошибками в `.errors`, fetch — `cause`); фолбэки message → name → errors[] → cause дают честный текст `connect ECONNREFUSED 127.0.0.1:9000` вместо «(пустая ошибка)».
- Случай «DB лежит + деградация»: warn НЕ попадает в error_events (INSERT синка молча фейлится) — это спроектированное отсутствие цикла (Q13), проверено живьём при упавшем docker.
- Ревью-принято (P3, осознанно): (1) DB-таймаут — `Promise.race`, не `AbortSignal.timeout` (у drizzle/postgres-js нет abort на запросе; кап 2 с тот же, задокументировано в коде); (2) minio-фолбэк — `wget`, не TCP `/dev/tcp` (wget есть в образе, /dev/tcp требует bash — эквивалентная проба живости; эмпирика на приёмке 05); (3) gateway-healthcheck порт захардкожен 3001 (= compose `PORT`).

# 04: Security-заголовки + entrypoint migrate + backup-db.sh + README

**What to build:** **Security-заголовки** (Q10): `async headers()` в `next.config.ts`, источник `/:path*` — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. CSP/HSTS НЕ добавлять (§9 после TLS/домена — фикс в спеке). **Entrypoint с миграциями** (Q11): `scripts/migrate.mjs` — plain ESM: `postgres` + `drizzle-orm/postgres-js` + `migrate(db, { migrationsFolder: './drizzle' })`, `DATABASE_URL` из `process.env` с dev-фолбэком :5560, retry ×3 с паузой 2 с, при исчерпании — `process.exit(1)` (restart: unless-stopped повторит); идемпотентно по `__drizzle_migrations`. **Force-trace**: `await import('drizzle-orm/postgres-js/migrator')` в `src/instrumentation.ts` с комментом-объяснением (file-tracing не видит динамический импорт из .mjs — иначе «Cannot find module» в standalone). Dockerfile runner: `COPY --from=build /app/drizzle ./drizzle`, `COPY scripts/migrate.mjs ./scripts/`, `CMD ["sh","-c","node scripts/migrate.mjs && exec node server.js"]`. Dev не меняется (`pnpm db:migrate` вручную как был). **Бэкап** (Q12): `scripts/backup-db.sh` (bash, исполняемый) — `mkdir -p backups` + `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres food_delivery | gzip > backups/food-$(date +%Y%m%d-%H%M%S).sql.gz`; шапка-коммент: назначение, restore-рецепт (`gunzip` → `DROP SCHEMA public CASCADE` → `psql -f` — в свежий volume или после сноса), заметка «cron — §9»; `backups/` в `.gitignore`. **README** — секция «Бэкап/восстановление»: скрипт, формат plain+gzip, restore-рецепт, ссылка на §9 (расписания). MinIO НЕ бэкапим.

**Blocked by:** —

**Status:** resolved

- [x] `next.config.ts` headers(): 4 заголовка на `/:path*`; curl -I на живом dev-сервере показал все четыре (+ `serverExternalPackages: ['pino','pino-pretty']` — тикет 02)
- [x] `scripts/migrate.mjs`: retry ×3, идемпотентно, exit(1) при исчерпании
- [x] Force-trace migrator в instrumentation.ts (коммент) + NEXT_RUNTIME-гвард; standalone-node_modules — проверка на приёмке 05 (fresh-migrate)
- [x] Dockerfile: COPY drizzle + migrate.mjs, CMD migrate→server; dev-поток не изменён
- [x] `scripts/backup-db.sh` + шапка с restore-рецептом; `backups/` в `.gitignore`
- [x] README секция «Бэкап/восстановление»
- [x] lint + `tsc --noEmit` ×2 + `pnpm build` зелёные

## Comments

- 2026-11-18 (реализация): force-trace + Edge-гвард соседствуют в register — динамический импорт мигратора выполняется только в Node-ветке (Edge-бандл его не тянет).
- Приёмка 05 уточнила механику (см. тикет 05): force-trace НЕДОСТАТОЧЕН — standalone бандлит не-external пакеты, `drizzle-orm`/`postgres` нужны в `serverExternalPackages` + ручной root-симлинк drizzle-orm в Dockerfile (nft копирует .pnpm-store без симлинка). Проверка резолва встроена в RUN.

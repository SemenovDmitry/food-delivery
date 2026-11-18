# 05: CI (GitHub Actions) + приёмка + пуш master

**What to build:** `.github/workflows/ci.yml` (Q9): `on: push: branches: [master]` + `workflow_dispatch`; два независимых джоба на ubuntu-latest: **unit** — actions/checkout v4, pnpm/action-setup v4 (version из packageManager), actions/setup-node v4 (node 22, cache pnpm), `pnpm install --frozen-lockfile`, `pnpm lint`, `tsc --noEmit` (root) + `tsc -p ws-gateway/tsconfig.json --noEmit`, `pnpm test:unit`; **e2e** — тот же setup + `docker compose -f docker-compose.dev.yml up -d --wait` (postgres/minio/mailpit) + `pnpm exec playwright install chromium --with-deps` + `pnpm test:e2e` (оркестратор 02 сам делает БД-setup/build/прогон; порт 5560 свободен на раннере); артефакт при падении: actions/upload-artifact v4 `if: failure()` — `playwright-report/` + `test-results/`. Приёмка: локально полный цикл (lint → tsc×2 → `pnpm build` → `pnpm test:unit` → `pnpm test:e2e` зелёные; dev-БД не замусорена — заказы e2e в `food_delivery_e2e`); AGENTS.md: §1 правка конвенции («без CI» → «CI: GitHub Actions, push в master»), §2 стек += vitest/@playwright/test, §3 срез, §6 чекбоксы этапа 12, грабли в §5 если найдены; **закоммитить этап** и **пуш master** — явное разрешение Q15 (~30 накопленных коммитов + этапы); верификация: публичная страница Actions репозитория зелёная (gh CLI не установлен — WebFetch). Замечание: e2e-джоб в CI — первый прогон может вскрыть env-разницу раннера (порт/локаль ICU); чинить в рамках тикета.

**Blocked by:** 04

**Status:** claimed

- [x] `.github/workflows/ci.yml`: джобы unit + e2e, артефакт при падении, chromium-only
- [x] Локальная приёмка: полный цикл зелёный (lint/tsc×2/unit + e2e 11/11), dev-БД чиста, e2e-БД изолирована
- [x] AGENTS §1 (конвенция CI) / §2 / §3 / §6 обновлены, §5.39 дополнен
- [ ] Коммит этапа 12 + **пуш master** (Q15-разрешение)
- [ ] Actions-прогон зелёный (верификация через публичную страницу)

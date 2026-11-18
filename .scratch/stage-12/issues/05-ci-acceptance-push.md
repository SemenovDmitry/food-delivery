# 05: CI (GitHub Actions) + приёмка + пуш master

**What to build:** `.github/workflows/ci.yml` (Q9): `on: push: branches: [master]` + `workflow_dispatch`; два независимых джоба на ubuntu-latest: **unit** — actions/checkout v4, pnpm/action-setup v4 (version из packageManager), actions/setup-node v4 (node 22, cache pnpm), `pnpm install --frozen-lockfile`, `pnpm lint`, `tsc --noEmit` (root) + `tsc -p ws-gateway/tsconfig.json --noEmit`, `pnpm test:unit`; **e2e** — тот же setup + `docker compose -f docker-compose.dev.yml up -d --wait` (postgres/minio/mailpit) + `pnpm exec playwright install chromium --with-deps` + `pnpm test:e2e` (оркестратор 02 сам делает БД-setup/build/прогон; порт 5560 свободен на раннере); артефакт при падении: actions/upload-artifact v4 `if: failure()` — `playwright-report/` + `test-results/`. Приёмка: локально полный цикл (lint → tsc×2 → `pnpm build` → `pnpm test:unit` → `pnpm test:e2e` зелёные; dev-БД не замусорена — заказы e2e в `food_delivery_e2e`); AGENTS.md: §1 правка конвенции («без CI» → «CI: GitHub Actions, push в master»), §2 стек += vitest/@playwright/test, §3 срез, §6 чекбоксы этапа 12, грабли в §5 если найдены; **закоммитить этап** и **пуш master** — явное разрешение Q15 (~30 накопленных коммитов + этапы); верификация: публичная страница Actions репозитория зелёная (gh CLI не установлен — WebFetch). Замечание: e2e-джоб в CI — первый прогон может вскрыть env-разницу раннера (порт/локаль ICU); чинить в рамках тикета.

**Blocked by:** 04

**Status:** resolved

- [x] `.github/workflows/ci.yml`: джобы unit + e2e, артефакт при падении, chromium-only
- [x] Локальная приёмка: полный цикл зелёный (lint/tsc×2/unit + e2e 11/11), dev-БД чиста, e2e-БД изолирована
- [x] AGENTS §1 (конвенция CI) / §2 / §3 / §6 обновлены, §5.39 дополнен
- [x] Коммит этапа 12 + **пуш master** (Q15-разрешение) — `6dffc5c..a842b53`, ~34 накопленных коммита
- [x] Actions-прогон зелёный (API верифицирован, run 44350266965: unit + e2e success)

## Comments

- 2026-11-18 (приёмка): первый CI-прогон (a842b53) — **e2e зелёная с первого раза, unit упал на `tsc --noEmit`**: типы маршрутов Next (`PageProps<'/orders/[id]'>`, `next-env.d.ts`) генерятся в `.next/types` при build/dev и НЕ в git — на раннере их нет, локально не ловится (.next всегда есть). Фикс: `pnpm exec next typegen` до tsc в джобе (генерит оба артефакта без БД и сборки; проверено локально mv+rm → typegen → EXIT 0). Повторный прогон (b157719, run 44350266965) — **success целиком**.
- Логи джоб — admin-only (403 без токена): статус дёргался публичным REST `/actions/runs` (gh CLI не нужен).
- Урок: pre-commit может падать тихо при `git commit && git push` в одной команде с `| tail` — коммит-вывод съедается, пуш уходит СТАРЫЙ HEAD (9080602 вместо ticket-05); верифицировать `git log` после пуша до верификации CI.

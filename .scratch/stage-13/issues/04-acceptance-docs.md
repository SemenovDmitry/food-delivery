# 04: Приёмка этапа 13 + документация

**What to build:** Приёмка (по прецеденту этапов): `pnpm storybook` живьём — проход по всем стори в обеих темах (скриншоты характерных стори: status-badge свет/тьма, counter-границы, checkout-form ошибки, order-tracker тик) в `.scratch/stage-13/screenshots/`; `pnpm build-storybook` зелёный (prod-сборка SB); полный цикл проекта не сломан (lint → tsc×2 → `pnpm build`); axe-отчёт по слайсу 1 чист (или обоснования задокументированы). Документация: AGENTS §2 стек += Storybook 10 (nextjs-vite), §3 срез состояния, §6 чекбоксы этапа 13 + ЗАВЕРШЁН, грабли в §5 (risks из тикета 01: next/font, Tailwind-плагин); README/roadmap §9 пометка «Storybook — сделано». Коммит этапа по прецеденту (реализация + приёмка); пуш — только по явной просьбе (этап 8).

**Blocked by:** 03 (этап 13)

**Status:** resolved

- [x] **Axe-аудит программно**: `scripts/storybook-a11y.mjs` (puppeteer + axe-core, WCAG 2.0/2.1 AA) — **50 сторей × 2 темы = 100 прогонов, 0 нарушений, 0 упало**; отчёт `.scratch/stage-13/a11y-report.json`
- [x] Скриншоты 6 характерных сторей × 2 темы — `.scratch/stage-13/screenshots/` (12 PNG)
- [x] `pnpm build-storybook` + полный цикл проекта зелёные
- [x] AGENTS §2/§3/§6 обновлены; находки этапа в комментариях тикетов (§5-новых нет — все находки ушли в фиксы)
- [x] Коммит этапа 13

## Comments

- 2026-11-19 (приёмка): **аудит нашёл и починил 5 РЕАЛЬНЫХ прод-проблем** (все фиксы — в прод-компонентах, не в сторях):
  1. **Radix Tabs без `TabsContent`** (checkout-form, cart-interactive): `aria-controls` указывал на несуществующие id → critical `aria-valid-attr-value`; фикс — панели-заглушки (aria-controls обязан ссылаться на существующий id, ARIA 1.2).
  2. **Ссылка в тексте различалась только цветом** (checkout-form «корзине») → `link-in-text-block` (WCAG 1.4.1); фикс — `underline`.
  3. **Статусные токены light** (`--status-info/progress/success`, L≈0.51–0.55) не дотягивали 4.5:1 на bg-X/10 → затемнены до L 0.44–0.45 (бейджи «Готовится»/«Готов» и т.д.).
  4. **`--destructive` light** (L 0.577) не дотягивал на bg-destructive/10 → затемнён до 0.45 (destructive-бейджи отмен).
  5. **muted-подписи на bg-primary/5** (promo-block conditionLabel + код «(SECRET15)») → `text-foreground/80`.
- **Storybook-инфра: алиас-моки** — `@/lib/actions/{cart,orders}` (use server цепочки), App Router-контексты провайдером в preview (`next/dist/shared/lib/*-context.shared-runtime`: AppRouter/Pathname/SearchParams — «invariant expected app router to be mounted» без провайдера; alias-подход не пробился сквозь бандл SB).
- Деградация аудита первой версии: `.mjs` без MIME-типа → ESM-чанки не исполняются (`text/javascript` обязателен) + per-story try/catch.

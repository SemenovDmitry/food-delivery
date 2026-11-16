# 01: Миграции этапа — isActive, position ×2, banned_at, deleted_at

**What to build:** Миграция drizzle-kit generate (SQL в git, §5.12): `products.isActive` boolean notNull default true; `products.position` int notNull default 0; `categories.position` int notNull default 0; `user.banned_at` timestamptz nullable; `user.deleted_at` timestamptz nullable (схема — `src/db/schema.ts` + типы). Начальные позиции пишет **сидер** (идемпотентно): категориям — индекс из `SEED_CATEGORIES`, товарам — индекс внутри своей категории (drizzle-kit DDL данных не бэкачит). `pnpm db:migrate` на dev-БД (postgres :5560).

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Схема: 5 колонок + обновление типов/экспортов
- [ ] `pnpm db:generate` — SQL-файл миграции закоммичен
- [ ] `pnpm db:migrate` на dev-БД
- [ ] Сидер пишет position категориям и товарам (идемпотентно, повторный seed не ломает порядок)
- [ ] Верификация: колонки в БД, позиции заполнены, повторный seed стабилен

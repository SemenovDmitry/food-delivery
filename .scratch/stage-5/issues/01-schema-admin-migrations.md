# 01: Миграции этапа — isActive, position ×2, banned_at, deleted_at

**What to build:** Миграция drizzle-kit generate (SQL в git, §5.12): `products.isActive` boolean notNull default true; `products.position` int notNull default 0; `categories.position` int notNull default 0; `user.banned_at` timestamptz nullable; `user.deleted_at` timestamptz nullable (схема — `src/db/schema.ts` + типы). Начальные позиции пишет **сидер** (идемпотентно): категориям — индекс из `SEED_CATEGORIES`, товарам — индекс внутри своей категории (drizzle-kit DDL данных не бэкачит). `pnpm db:migrate` на dev-БД (postgres :5560).

**Blocked by:** —

**Status:** resolved

- [x] Схема: 5 колонок + обновление типов/экспортов
- [x] `pnpm db:generate` — SQL-файл миграции закоммичен (drizzle/0004_marvelous_firedrake.sql)
- [x] `pnpm db:migrate` на dev-БД
- [x] Сидер пишет position категориям и товарам (идемпотентно; position пишется и в update-ветке — сид задаёт канонический порядок, админ-сортировка живёт до явного `db:seed`)
- [x] Верификация: колонки в БД, позиции заполнены, повторный seed стабилен

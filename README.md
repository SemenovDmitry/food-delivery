# Food Delivery

Учебный food delivery (по образцу Додо Пицца): **шаурма и пицца** + сеты со скидкой, напитки, десерты. Полный стек на Next.js 16 — без отдельного бэкенда. Каждый этап roadmap демонстрирует фичу Next.js 16.

## Стек

Next.js 16 (App Router, Turbopack, Cache Components, Partial Prefetching, React Compiler) · React 19 · TypeScript strict · Tailwind v4 + shadcn/ui · PostgreSQL 17 + Drizzle ORM · better-auth · MinIO + sharp · AI SDK 7 · Docker (multi-stage, standalone) · pnpm 11.

## Быстрый старт

```bash
pnpm install
cp .env.example .env        # заполнить AUTH_SECRET (openssl rand -base64 32)
docker compose -f docker-compose.dev.yml up -d   # postgres + minio + mailpit
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Mailpit (письма): http://localhost:8025 · MinIO: http://localhost:9000

Демо-аккаунты (вход по телефону, SMS-код всегда `1111`):
`+7 999 000-00-01` (admin) · `+7 999 000-00-02` (manager) · `+7 999 000-00-03` (клиент)

## Roadmap обучения

| Этап | Что | Фича Next.js |
|------|-----|--------------|
| 0 | Базовая кодовая база, Docker, схема, каркас магазина | Cache Components, React Compiler, intercepting routes |
| 1 | Корзина и чекаут (серверная корзина) | Server Actions, useOptimistic, dynamic fragments |
| 2 | Акции | ETag, Cache-Control, кеш-теги |
| 3 | Auth + история заказов | better-auth, слияние корзины |
| 4 | Трекинг заказа | polling + ETag 304, error/loading/not-found |
| 5 | Админка + картинки | MinIO/S3, next/image, proxy-гард |
| 6 | AI-ассистент | AI SDK 7, streaming, tools |
| 7 | Верификация | lint/build, Lighthouse a11y |
| 8 | Git | коммиты по этапам |
| 9 | Оплата (мок-провайдер с webhook-контрактом) | Route Handlers, HMAC |
| 10 | Уведомления (аутбокс) + автоджоба | транзакционный аутбокс |
| 11 | Ops-харднинг | health, структурные логи, security-заголовки |

План и статус ведутся в [AGENTS.md](./AGENTS.md); термины домена — [GLOSSARY.md](./GLOSSARY.md).

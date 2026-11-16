# 08: Инфраструктура — env, Docker шлюза, prod-compose, pre-commit ×2

**What to build:** Обвязка сборки и локальных процессов (Q11/Q12): `.env.example` += `NEXT_PUBLIC_WS_URL=ws://localhost:3001` (коммент: первый NEXT_PUBLIC_*, инлайнится на build) и `INTERNAL_API_SECRET` (коммент: общий для Next и шлюза, dev — любое значение). Корневой Dockerfile: `ARG NEXT_PUBLIC_WS_URL` (дефолт `ws://localhost:3001`) + ENV на build-стадии — фолбэк-переменной для клиентского кода не существует (§5.32-г). prod-compose: сервис `ws-gateway` (build ./ws-gateway, порт 3001 наружу — браузер должен доставаться, env DATABASE_URL / NEXT_INTERNAL_URL=http://app:3000 / INTERNAL_API_SECRET / PORT, depends_on) + app-сервису `build.args` с NEXT_PUBLIC_WS_URL. `ws-gateway/Dockerfile` multi-stage по образцу корневого (deps копирует package.json + pnpm-lock.yaml + pnpm-workspace.yaml, install --frozen-lockfile по workspace; build tsc; runner — node dist). Локальные скрипты: `pnpm dev:gateway` (тикет 05). Корневой tsconfig исключает `ws-gateway` (другой moduleResolution); pre-commit (`scripts/hooks/pre-commit`, §5.27) гоняет `tsc -p .` И `tsc -p ws-gateway`. Biome пакет не исключается (покрывается по умолчанию).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `.env.example`: две новые переменные с комментами
- [ ] ARG+ENV NEXT_PUBLIC_WS_URL на build-стадии корневого Dockerfile; app build.args в prod-compose
- [ ] `ws-gateway/Dockerfile` multi-stage; docker build шлюза проходит локально
- [ ] prod-compose: сервис шлюза (порт 3001, env, depends_on) поднимается вместе со стеком
- [ ] Root tsconfig exclude + pre-commit tsc ×2 (хук зелёный на чистом дереве)
- [ ] Дисциплина §5.13: docker build + `docker compose up` проходят перед коммитом этапа

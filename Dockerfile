# multi-stage: deps → build → runner (standalone, pnpm)
FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* инлайнятся в бандл ТОЛЬКО на build (§5.32-г): адрес WS-шлюза для
# браузера. ARG переопределяется build.args из prod-compose; дефолт — локальный
# prod-стек (фолбэк-переменной для клиентского кода не существует).
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_TELEMETRY_DISABLED=1
# Заглушка только на СБОРКУ (better-auth валидирует секрет при инициализации модуля;
# нейтральное имя — чтобы не триггерить BuildKit SecretsUsedInArgOrEnv)
ENV AUTH_SECRET_BUILD_FALLBACK=docker-build-placeholder-not-a-secret
# next.config печётся на build (§5.3): remotePatterns картинок вычисляется из
# S3_ENDPOINT, которого в build-стадии нет — фолбэк на prod-хост compose
# (в рантайме runner использует настоящий S3_ENDPOINT из environment)
ENV S3_ENDPOINT_BUILD_FALLBACK=http://minio:9000
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Entrypoint с миграциями (этап 11, Q11): drizzle/ (SQL-файлы) + migrate-скрипт.
# migrator попадает в standalone node_modules через force-trace в
# instrumentation.ts (file-tracing не видит .mjs-динамику — тикет 04)
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# Healthcheck (этап 11, Q5-а): busybox wget (curl в alpine нет); 503 от
# /api/health = фейл = unhealthy. start-period покрывает migrate + старт сервера
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
# Миграции до сервера: упали → процесс умер → restart: unless-stopped повторит
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]

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
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]

# multi-stage WS-шлюза (этап 6): deps → build → runner (образец корневого Dockerfile)
# Контекст сборки — корень репо (compose: context ., dockerfile ws-gateway/Dockerfile):
# pnpm-workspace требует корневые манифесты + lockfile.
FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ws-gateway/package.json ws-gateway/
# --legacy: pnpm 10+ требует inject-workspace-packages для обычного deploy (грабль §5.4-смежный)
RUN pnpm install --frozen-lockfile && pnpm --filter ws-gateway deploy --prod --legacy /out

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
# ws/postgres/zod живут в workspace-node_modules пакета (симлинки в .pnpm) —
# без них tsc не видит модули (найдено на приёмке этапа 6)
COPY --from=deps /app/ws-gateway/node_modules ./ws-gateway/node_modules
COPY ws-gateway/ ./ws-gateway/
# tsc напрямую, не через pnpm-скрипт: verifyDepsBeforeRun в pnpm 11 хочет
# пёрдж node_modules перед run (нет TTY → abort, найдено на приёмке этапа 6)
RUN /app/node_modules/.bin/tsc -p ws-gateway/tsconfig.json

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S gateway -u 1001
# /out из pnpm deploy — самодостаточные prod-зависимости шлюза (ws/postgres/zod)
COPY --from=deps --chown=gateway:nodejs /out/node_modules ./node_modules
COPY --from=deps --chown=gateway:nodejs /out/package.json ./
COPY --from=build --chown=gateway:nodejs /app/ws-gateway/dist ./dist
USER gateway
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/index.js"]

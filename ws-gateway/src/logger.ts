import pino from 'pino'
import { env } from './env.js'

/**
 * Структурные логи шлюза (этап 11, Q9): JSON в stdout — собственный pino БЕЗ
 * DB-sink (drizzle-схема app'а шлюзу не нужна; ошибки шлюза живут в docker
 * logs). service='ws-gateway' — в общем стдауте компоуза пакеты различаются.
 */
export const logger = pino({
	level: env.LOG_LEVEL,
	base: { service: 'ws-gateway', env: process.env.NODE_ENV ?? 'production' },
})

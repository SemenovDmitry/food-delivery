import { Writable } from 'node:stream'
import pino from 'pino'
import pretty from 'pino-pretty'
import { db } from '@/db'
import { errorEvents } from '@/db/schema'
import { env, IS_BUILD } from '@/lib/env'

/**
 * Структурные логи (этап 11, Q6/Q8, GLOSSARY «Sink»): pino в stdout.
 * - dev (`NODE_ENV !== 'production'`) — pino-pretty потоком В ПРОЦЕССЕ (не
 *   worker-transport: transport хрупок под бандлеры, вывод тот же);
 * - prod — голый JSON в stdout (парсят docker logs / сборщики логов);
 * - DB-sink: записи `level ≥ 40` (warn/error/fatal) fire-and-forget'ом падают
 *   в `error_events` — задел под Sentry (§9). Сбой вставки МОЛЧИТ (цикла
 *   «DB лежит → лог → INSERT → лог» не возникает); stdout пишется всегда.
 *   На build (`NEXT_PHASE=phase-production-build`) sink выключен.
 * Уровни pino: trace=10 … fatal=60; порог sink'а — `warn` (multistream-филтр).
 * Потребители: `logger.child({ component: 'autostatus' })` — component
 * попадает в каждое поле записи (и в `error_events.context`).
 * request-id — `getRequestId()` (lib/request-id.ts), поле `requestId`.
 */

const STACK_CAP = 8000

/** NDJSON-буфер: chunks бывают частичными/склеенными — копим до конца строки */
class ErrorEventsSink extends Writable {
	private buffer = ''

	override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: (err?: Error | null) => void) {
		if (IS_BUILD) return cb()
		this.buffer += chunk.toString()
		const lines = this.buffer.split('\n')
		this.buffer = lines.pop() ?? ''
		for (const line of lines) this.persist(line)
		cb()
	}

	override _final(cb: (err?: Error | null) => void) {
		if (this.buffer) this.persist(this.buffer)
		cb()
	}

	private persist(line: string): void {
		let record: {
			level: number
			msg?: string
			err?: { stack?: string }
			requestId?: string
			component?: string
		} & Record<string, unknown>
		try {
			record = JSON.parse(line)
		} catch {
			return // не-JSON строка мимо pino — не наше
		}
		if (record.level < 40) return
		const { level, msg, err, requestId, component, ...rest } = record
		// fire-and-forget: сбой вставки молчит — error_events никогда не логирует
		// сам себя, stdout-запись не зависит от БД
		void db
			.insert(errorEvents)
			.values({
				level: level >= 50 ? 'error' : 'warn',
				message: msg ?? '(без сообщения)',
				stack: err?.stack?.slice(0, STACK_CAP) ?? null,
				context: { requestId, component, ...rest },
			})
			.catch(() => {})
	}
}

const streams: pino.StreamEntry[] = []
if (process.env.NODE_ENV !== 'production') {
	// dev: pretty ЗАМЕНЯЕТ сырой stdout (иначе дубль каждой строки)
	streams.push({
		level: 'trace',
		stream: pretty({
			colorize: true,
			translateTime: 'SYS:HH:MM:ss',
			ignore: 'pid,hostname,service',
		}),
	})
} else {
	streams.push({ level: 'trace', stream: pino.destination({ fd: 1 }) })
}
streams.push({ level: 'warn', stream: new ErrorEventsSink() })

export const logger = pino(
	{
		level: env.LOG_LEVEL,
		base: { service: 'food-delivery', env: process.env.NODE_ENV },
	},
	pino.multistream(streams),
)

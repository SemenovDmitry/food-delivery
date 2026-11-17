import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { getChannelProvider, type NotificationPayload } from '@/lib/notifications/providers'

/**
 * Флушер аутбокса (этап 10, §5.16, Q7): setInterval-синглтон 30 с — стартует
 * из instrumentation.ts (один раз на процесс сервера). Тик: pending строки
 * (батч 20 по createdAt) → провайдер канала → sent | failed (+error).
 * failed — терминален, ретраев нет: SMTP-сбой не должен лупить бесконечно,
 * повторная отправка неидемпотентного уведомления хуже пропуска.
 * flushOnce() экспортируется отдельно для смоука (tsx), startFlusher() —
 * для instrumentation.
 */

const FLUSH_INTERVAL_MS = 30_000
const BATCH_SIZE = 20

export async function flushOnce(): Promise<{ sent: number; failed: number }> {
	const pending = await db
		.select()
		.from(notifications)
		.where(eq(notifications.status, 'pending'))
		.orderBy(asc(notifications.createdAt))
		.limit(BATCH_SIZE)

	let sent = 0
	let failed = 0

	for (const row of pending) {
		try {
			const provider = getChannelProvider(row.channel)
			// jsonb приходит unknown — шов валидации полей внутри провайдера (readString)
			await provider.send(row.payload as NotificationPayload)
			await db
				.update(notifications)
				.set({ status: 'sent', updatedAt: new Date() })
				.where(eq(notifications.id, row.id))
			sent += 1
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(`[аутбокс] ${row.channel}/${row.event} ${row.id} → failed: ${message}`)
			await db
				.update(notifications)
				.set({ status: 'failed', error: message, updatedAt: new Date() })
				.where(eq(notifications.id, row.id))
			failed += 1
		}
	}

	return { sent, failed }
}

/** Старт периодического тика; globalThis-гвард — страховка от двойного setInterval */
export function startFlusher(): void {
	const g = globalThis as { __foodFlusherStarted?: boolean }
	if (g.__foodFlusherStarted) return
	g.__foodFlusherStarted = true
	console.log('[аутбокс] флушер стартовал (интервал 30 с)')
	setInterval(() => {
		flushOnce().catch((error) => console.error('[аутбокс] тик флушера упал', error))
	}, FLUSH_INTERVAL_MS).unref?.()
}

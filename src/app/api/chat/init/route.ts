import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import type { ChatThread } from '@/db/schema'

import {
	CHAT_COOKIE,
	CHAT_COOKIE_MAX_AGE,
	getThreadHistory,
	markRead,
	resolveCustomerThread,
	toBroadcastMessage,
} from '@/lib/chat'
import { isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import { getRequestId } from '@/lib/request-id'
import { getSession } from '@/lib/session'

const log = logger.child({ component: 'chat' })

/**
 * Идентичность и история чата (этап 6, Q2/Q4): сессия → тред по userId
 * (с усиновлением гостевого по куке, если своего ещё нет), иначе кука
 * `chat_token` → гостевой тред, иначе выдача куки + новый тред. Каждый вызов
 * открывает окно → customer_last_read_at = now. POST — мутирует
 * (кука/тред/last_read), поэтому GET-семантики и кеширования нет.
 */
export async function POST(): Promise<Response> {
	try {
		const session = await getSession()
		const cookieStore = await cookies()
		const cookieToken = cookieStore.get(CHAT_COOKIE)?.value

		let thread: ChatThread
		if (session) {
			thread = await resolveCustomerThread({ userId: session.user.id, guestToken: cookieToken })
		} else if (cookieToken && isUuid(cookieToken)) {
			thread = await resolveCustomerThread({ guestToken: cookieToken })
		} else {
			const token = randomUUID()
			thread = await resolveCustomerThread({ guestToken: token })
			cookieStore.set(CHAT_COOKIE, token, {
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				maxAge: CHAT_COOKIE_MAX_AGE,
			})
		}

		await markRead(thread.id, 'customer')
		const history = await getThreadHistory(thread.id)

		return Response.json(
			{ threadId: thread.id, messages: history.map(toBroadcastMessage) },
			{ headers: { 'Cache-Control': 'no-store' } },
		)
	} catch (error) {
		log.error({ err: error, requestId: await getRequestId() }, 'chat/init упал')
		return Response.json({ error: 'Не удалось открыть чат' }, { status: 500 })
	}
}

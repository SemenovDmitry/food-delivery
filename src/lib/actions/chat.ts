'use server'

import { cookies } from 'next/headers'

import {
	CHAT_COOKIE,
	getOperatorThreads,
	getThreadHistory,
	getUnreadForCustomer,
	toBroadcastMessage,
} from '@/lib/chat'
import { isUuid } from '@/lib/id'
import { enforceNotBlocked, getSession, requireAdmin } from '@/lib/session'
import type { ActionResult } from '@/lib/types'
import type { ChatBroadcastMessage } from '@/lib/ws-protocol'

/**
 * Бейдж непрочитанных при закрытом виджете (Q3): клиент поллит 30 с,
 * старт — только после первого открытия чата (флаг в localStorage).
 * Возвращает число без ActionResult: неудачный тик молча превращается в 0 —
 * тост на каждый сбой поллинга недопустим (осознанное исключение из
 * конвенции actions, избыточных ошибок у чистого чтения нет).
 */
export async function getChatUnread(): Promise<number> {
	try {
		const session = await getSession()
		if (session) return getUnreadForCustomer({ userId: session.user.id })
		const cookieStore = await cookies()
		const token = cookieStore.get(CHAT_COOKIE)?.value
		if (!token) return 0 // нет куки — нет треда, БД не трогаем
		return getUnreadForCustomer({ guestToken: token })
	} catch {
		return 0
	}
}

/**
 * История открытого таба операторской (Q6): internal-роут браузеру недоступен
 * (x-internal-secret), поэтому чтение — action с живыми гардами этапа 5.
 * type ChatBroadcastMessage без поля threadId: тред известен из аргумента.
 */
export async function getThreadMessages(
	threadId: string,
): Promise<ActionResult<{ messages: Omit<ChatBroadcastMessage, 'threadId'>[] }>> {
	await enforceNotBlocked()
	await requireAdmin()
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(threadId)) return { data: null, error: 'Тред не найден' }

	const history = await getThreadHistory(threadId)
	return {
		data: { messages: history.map(toBroadcastMessage) },
		error: null,
	}
}

/**
 * Список тредов операторской как action: реконнект консоли после обрыва шлюза
 * перечитывает треды/unread — NOTIFY, пропущенные за оффлайн, восстанавливаются
 * (ревью этапа 6: инкремент-only бейджи теряли события навсегда).
 */
export async function getOperatorThreadsAction(): Promise<
	ActionResult<{ threads: { id: string; phone: string | null; unread: number }[] }>
> {
	await enforceNotBlocked()
	await requireAdmin()
	const threads = await getOperatorThreads()
	return {
		data: {
			threads: threads.map((thread) => ({
				id: thread.id,
				phone: thread.phone,
				unread: thread.unread,
			})),
		},
		error: null,
	}
}

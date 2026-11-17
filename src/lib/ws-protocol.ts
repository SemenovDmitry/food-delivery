/**
 * Контракт WS-протокола чата (этап 6, §5.22) — сторона Next.
 * В ws-gateway — минимальный дубликат (граница, не библиотека, Q14):
 * шлюз — граничный сервис, синхронизируется по этому файлу.
 */
import type { ChatDirection } from '@/db/schema'

export type ChatOperatorRole = 'admin' | 'manager'

/**
 * Идентичность соединения/записи; кладёт шлюз из upgrade-аутентификации
 * (cookies → get-session или кука `chat_token`). Next перевалидирует каждый
 * send живым срезом БД — идентичности шлюза доверяет после собственного гарда.
 */
export type ChatIdentity =
	| { kind: 'customer'; userId: string }
	| { kind: 'guest'; token: string }
	| { kind: 'operator'; userId: string; role: ChatOperatorRole }

/** Коды ошибок записи (тосты виджета и консоли) */
export type ChatErrorCode = 'validation' | 'forbidden' | 'banned' | 'unavailable'

/** Сообщение чата в эфире: payload NOTIFY и broadcast (createdAt — ISO) */
export type ChatBroadcastMessage = {
	id: number
	direction: ChatDirection
	text: string
	createdAt: string
	senderId: string | null
}

/**
 * Payload NOTIFY канала `chat` (Q9): телефон для заголовка таба кладёт Next
 * в момент вставки — шлюз остаётся без БД-чтений. Кап 2000 гарантирует < 8 КБ.
 */
export type ChatNotifyPayload = {
	threadId: string
	phone: string | null
	message: ChatBroadcastMessage
}

/** Клиент → шлюз */
export type ChatClientMessage =
	| { type: 'subscribe'; threadId: string }
	| { type: 'subscribe-operators' }
	| { type: 'send'; threadId: string; text: string; tempId: string }
	| { type: 'read'; threadId: string }

/** Шлюз → клиенту */
export type ChatServerMessage =
	| { type: 'ack'; tempId: string; message: ChatBroadcastMessage }
	| { type: 'error'; tempId?: string; code: ChatErrorCode }
	| { type: 'message'; threadId: string; phone: string | null; message: ChatBroadcastMessage }

/** Тело служебного роута (шлюз → Next, x-internal-secret); discriminated union (Q9) */
export type ChatInternalRequest =
	| { action: 'send'; identity: ChatIdentity; threadId: string; text: string }
	| { action: 'read'; identity: ChatIdentity; threadId: string }
	| { action: 'join'; identity: ChatIdentity; threadId: string }

export type ChatInternalResponse =
	| { ok: true; message?: ChatBroadcastMessage }
	| { ok: false; code: ChatErrorCode }

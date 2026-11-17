/**
 * Минимальный дубликат протокола чата (Q14 — граница, не библиотека).
 * Контракт — src/lib/ws-protocol.ts в монорепо; правки синхронизировать вручную.
 */

export type ChatIdentity =
	| { kind: 'customer'; userId: string }
	| { kind: 'guest'; token: string }
	| { kind: 'operator'; userId: string; role: 'admin' | 'manager' }

export type ChatErrorCode = 'validation' | 'forbidden' | 'banned' | 'unavailable'

export type ChatBroadcastMessage = {
	id: number
	direction: 'customer' | 'operator'
	text: string
	createdAt: string
	senderId: string | null
}

/** Payload NOTIFY канала `chat` (телефон кладёт Next при вставке) */
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

/** Шлюз → Next (служебный роут /api/chat/internal) */
export type ChatInternalRequest =
	| { action: 'send'; identity: ChatIdentity; threadId: string; text: string }
	| { action: 'read'; identity: ChatIdentity; threadId: string }
	| { action: 'join'; identity: ChatIdentity; threadId: string }

export type ChatInternalResponse =
	| { ok: true; message?: ChatBroadcastMessage }
	| { ok: false; code: ChatErrorCode }

/**
 * Чистые функции клиентского стейта сообщений чата (виджет + операторская).
 * Общая механика варианта C (Q1): отправитель рендерит из эха — echo может
 * обогнать ack, dedupe по реальному id, pending-строки с tempId.
 */
import type { ChatBroadcastMessage } from '@/lib/ws-protocol'

export type ChatMessageItem = {
	key: string
	id?: number
	tempId?: string
	direction: 'customer' | 'operator'
	text: string
	createdAt: string
	status?: 'sending' | 'failed'
}

export function toChatMessageItem(message: ChatBroadcastMessage): ChatMessageItem {
	return {
		key: `m-${message.id}`,
		id: message.id,
		direction: message.direction,
		text: message.text,
		createdAt: message.createdAt,
	}
}

/** Ack: pending с этим tempId → реальное сообщение; echo уже добавил — pending убрать */
export function promoteByTempId(
	messages: ChatMessageItem[],
	tempId: string,
	message: ChatBroadcastMessage,
): ChatMessageItem[] {
	const pendingIdx = messages.findIndex((item) => item.tempId === tempId)
	if (pendingIdx === -1) {
		return messages.some((item) => item.id === message.id)
			? messages
			: [...messages, toChatMessageItem(message)]
	}
	if (messages.some((item) => item.id === message.id)) {
		return messages.filter((item) => item.tempId !== tempId)
	}
	const next = [...messages]
	next[pendingIdx] = toChatMessageItem(message)
	return next
}

/** Echo/broadcast: dedupe по id; наш echo обогнал ack — подменяем pending с тем же текстом (FIFO) */
export function upsertMessage(
	messages: ChatMessageItem[],
	message: ChatBroadcastMessage,
): ChatMessageItem[] {
	if (messages.some((item) => item.id === message.id)) return messages
	const pendingIdx = messages.findIndex(
		(item) =>
			item.status === 'sending' &&
			item.direction === message.direction &&
			item.text === message.text,
	)
	if (pendingIdx === -1) return [...messages, toChatMessageItem(message)]
	const next = [...messages]
	next[pendingIdx] = toChatMessageItem(message)
	return next
}

/** Ошибка отправки: pending с этим tempId → failed */
export function failByTempId(messages: ChatMessageItem[], tempId: string): ChatMessageItem[] {
	return messages.map((item) => (item.tempId === tempId ? { ...item, status: 'failed' } : item))
}

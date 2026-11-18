import { env } from './env.js'
import { logger } from './logger.js'
import type { ChatInternalRequest, ChatInternalResponse } from './protocol.js'

export type InternalResult = {
	status: number
	body: ChatInternalResponse | null
}

/**
 * Релей записей в Next (§5.22, вариант C): секрет остаётся на сервере —
 * в браузер не попадает никогда. Ошибка сети → status 0, клиент получит
 * error/unavailable (WS упал → инпут дизейблится, HTTP-фолбэка нет).
 */
export async function relayInternal(request: ChatInternalRequest): Promise<InternalResult> {
	try {
		const response = await fetch(`${env.NEXT_INTERNAL_URL}/api/chat/internal`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-internal-secret': env.INTERNAL_API_SECRET,
			},
			body: JSON.stringify(request),
		})
		const body = (await response.json().catch(() => null)) as ChatInternalResponse | null
		return { status: response.status, body }
	} catch (error) {
		logger.error({ err: error }, 'релей недоступен')
		return { status: 0, body: null }
	}
}

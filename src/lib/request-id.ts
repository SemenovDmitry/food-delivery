import { headers } from 'next/headers'

/**
 * Request-id текущего запроса (этап 11, Q7): ставится proxy'ем в
 * `x-request-id` (и наружу — `X-Request-Id`). Читать ТОЛЬКО в некешируемых
 * скоупах — Route Handlers, Server Actions, error-границы; в `'use cache'`
 * чтение заголовков запрещено (§5.3-семья: URL/запрос-данные в кеше).
 * Вне request-скоупа (джобы, смоук, instrumentation) `headers()` бросает —
 * ловим и возвращаем null: у джоб вместо requestId поле `component`.
 */
export async function getRequestId(): Promise<string | null> {
	try {
		const store = await headers()
		return store.get('x-request-id')
	} catch {
		return null
	}
}

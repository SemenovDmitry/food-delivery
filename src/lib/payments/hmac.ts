import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * HMAC-подпись webhook'а (этап 9, Q1): секрет знают только сервер провайдера
 * и наш webhook-роут. Сравнение — timingSafeEqual (постоянное время), подпись
 * считается по сырому телу запроса.
 */

export const WEBHOOK_SIGNATURE_HEADER = 'x-payment-signature'

/** Провайдер подписывает payload перед loopback-POST'ом (confirm-эндпоинт) */
export function signHmac(rawBody: string, secret: string): string {
	return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

/** Webhook-роут сверяет заголовок с подписью сырому телу; прокол → false → 400 */
export function verifyHmac(rawBody: string, secret: string, signature: string): boolean {
	const expected = signHmac(rawBody, secret)
	const a = Buffer.from(expected, 'utf8')
	const b = Buffer.from(signature, 'utf8')
	if (a.length !== b.length) return false
	return timingSafeEqual(a, b)
}

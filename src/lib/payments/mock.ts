import { randomUUID } from 'node:crypto'
import { verifyHmac, WEBHOOK_SIGNATURE_HEADER } from './hmac'
import type { InitiateInput, InitiateResult, PaymentProvider, WebhookEvent } from './types'

/**
 * MockProvider (GLOSSARY «Мок-провайдер»): настоящий контракт с заглушкой.
 * initiate не обращается наружу — externalId локальный, redirectUrl ведёт на
 * нашу страницу «сайта провайдера» ((provider)/orders/[id]/pay), где подпись
 * ставит сервер (confirm-эндпоинт, Q1-Б). verifyWebhook — честная проверка
 * HMAC: этим же кодом когда-нибудь примет звонок реального провайдера.
 */
export class MockProvider implements PaymentProvider {
	async initiate(input: InitiateInput): Promise<InitiateResult> {
		return {
			externalId: `mock_${randomUUID()}`,
			redirectUrl: `/orders/${input.orderId}/pay`,
		}
	}

	async verifyWebhook(headers: Headers, rawBody: string): Promise<WebhookEvent | null> {
		const secret = process.env.PAYMENTS_WEBHOOK_SECRET
		if (!secret) return null
		const signature = headers.get(WEBHOOK_SIGNATURE_HEADER)
		if (!signature || !verifyHmac(rawBody, secret, signature)) return null

		try {
			const parsed: unknown = JSON.parse(rawBody)
			if (typeof parsed !== 'object' || parsed === null) return null
			const { paymentId, status } = parsed as Record<string, unknown>
			if (typeof paymentId !== 'string' || !paymentId) return null
			if (status !== 'paid' && status !== 'failed') return null
			return { paymentId, status }
		} catch {
			return null // кривой JSON — не событие
		}
	}
}

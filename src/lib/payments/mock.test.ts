import { describe, expect, it } from 'vitest'
import { env } from '@/lib/env'
import { signHmac, WEBHOOK_SIGNATURE_HEADER } from './hmac'
import { MockProvider } from './mock'

const BODY = '{"paymentId":"123e4567-e89b-12d3-a456-426614174000","status":"refunded"}'

/** Мок-провайдер: refund (этап 14) и webhook-контракт refunded */
describe('MockProvider.refund', () => {
	const provider = new MockProvider()

	it('возвращает refundId в формате mock_refund_*', async () => {
		const result = await provider.refund({ externalId: 'mock_x', amount: 123400 })
		expect(result.refundId).toMatch(/^mock_refund_[0-9a-f-]{36}$/)
	})

	it('refundId уникален между вызовами', async () => {
		const a = await provider.refund({ externalId: 'mock_x', amount: 1 })
		const b = await provider.refund({ externalId: 'mock_x', amount: 1 })
		expect(a.refundId).not.toBe(b.refundId)
	})
})

describe('MockProvider.verifyWebhook — refunded (этап 14)', () => {
	const provider = new MockProvider()

	function headersWith(body: string): Headers {
		const headers = new Headers()
		headers.set(WEBHOOK_SIGNATURE_HEADER, signHmac(body, env.PAYMENTS_WEBHOOK_SECRET))
		return headers
	}

	it('валидная подпись + refunded → событие', async () => {
		const event = await provider.verifyWebhook(headersWith(BODY), BODY)
		expect(event).toEqual({
			paymentId: '123e4567-e89b-12d3-a456-426614174000',
			status: 'refunded',
		})
	})

	it('кривая подпись → null', async () => {
		const headers = new Headers()
		headers.set(WEBHOOK_SIGNATURE_HEADER, 'deadbeef')
		expect(await provider.verifyWebhook(headers, BODY)).toBeNull()
	})

	it('невалидный статус → null', async () => {
		const body = '{"paymentId":"123e4567-e89b-12d3-a456-426614174000","status":"refunding"}'
		expect(await provider.verifyWebhook(headersWith(body), body)).toBeNull()
	})
})

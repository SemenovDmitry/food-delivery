import { describe, expect, it } from 'vitest'
import { signHmac, verifyHmac, WEBHOOK_SIGNATURE_HEADER } from './hmac'

const BODY = '{"event":"payment.succeeded","orderId":"abc","amount":123400}'
const SECRET = 'test-webhook-secret'

describe('signHmac / verifyHmac — webhook-контракт (этап 9)', () => {
	it('подпись — 64 hex-символа sha256', () => {
		expect(signHmac(BODY, SECRET)).toMatch(/^[0-9a-f]{64}$/)
	})

	it('раундтрип — своя подпись проходит', () => {
		expect(verifyHmac(BODY, SECRET, signHmac(BODY, SECRET))).toBe(true)
	})

	it('чужой секрет — 400', () => {
		expect(verifyHmac(BODY, 'other-secret', signHmac(BODY, SECRET))).toBe(false)
	})

	it('подделка тела — 400 (подпись по сырому телу)', () => {
		const signature = signHmac(BODY, SECRET)
		expect(verifyHmac(`${BODY} `, SECRET, signature)).toBe(false)
	})

	it('подпись другой длины — false без exceptions (гвард перед timingSafeEqual)', () => {
		expect(verifyHmac(BODY, SECRET, 'abc')).toBe(false)
	})

	it('uppercase-подпись не проходит (hex сравнивается байтово)', () => {
		const signature = signHmac(BODY, SECRET).toUpperCase()
		expect(verifyHmac(BODY, SECRET, signature)).toBe(false)
	})
})

describe('WEBHOOK_SIGNATURE_HEADER', () => {
	it('контракт заголовка стабилен', () => {
		expect(WEBHOOK_SIGNATURE_HEADER).toBe('x-payment-signature')
	})
})

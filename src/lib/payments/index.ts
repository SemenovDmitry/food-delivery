import { MockProvider } from './mock'
import type { PaymentProvider } from './types'

export { signHmac, verifyHmac, WEBHOOK_SIGNATURE_HEADER } from './hmac'
export * from './types'
export { applyPaymentEvent, type PaymentEventOutcome } from './webhook-core'
export { paymentWindowMinutes } from './window'

/**
 * Фабрика провайдера по env PAYMENT_PROVIDER (Q6). Throw ВНУТРИ вызова, не
 * module-level: module-level throw валит `next build` (урок этапа 6, §5.22-семья).
 */
export function getPaymentProvider(): PaymentProvider {
	const provider = process.env.PAYMENT_PROVIDER ?? 'mock'
	if (provider === 'mock') return new MockProvider()
	throw new Error(`Неизвестный PAYMENT_PROVIDER: ${provider}`)
}

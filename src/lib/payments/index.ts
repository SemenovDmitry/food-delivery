import { env } from '@/lib/env'
import { MockProvider } from './mock'
import type { PaymentProvider } from './types'

export { signHmac, verifyHmac, WEBHOOK_SIGNATURE_HEADER } from './hmac'
export * from './types'
export { applyPaymentEvent, type PaymentEventOutcome } from './webhook-core'
export { paymentWindowMinutes } from './window'

/**
 * Фабрика провайдера по env PAYMENT_PROVIDER (Q6; значение — env-схема этапа 11).
 * Throw ВНУТРИ вызова, не module-level: module-level throw валит `next build`
 * (урок этапа 6, §5.22-семья).
 */
export function getPaymentProvider(): PaymentProvider {
	if (env.PAYMENT_PROVIDER === 'mock') return new MockProvider()
	throw new Error(`Неизвестный PAYMENT_PROVIDER: ${env.PAYMENT_PROVIDER}`)
}

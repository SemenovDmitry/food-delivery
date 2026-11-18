import { env } from '@/lib/env'

/**
 * Окно оплаты онлайн-заказа (этап 9, Q17/Q13): минуты от orders.createdAt;
 * просрочка → cancelled_by_timeout. Значение — из env-схемы (этап 11, Q3):
 * кривое/вне границ 1..60 → падение на старте (было: молчаливый дефолт 5).
 * Отдельный файл: ядро webhook-core импортирует функцию без циркулярной
 * зависимости с фабрикой index.ts.
 */
export function paymentWindowMinutes(): number {
	return env.PAYMENT_WINDOW_MINUTES
}

/**
 * Момент, до которого окно оплаты живо: `createdAt < cutoff` ⇒ просрочен.
 * Единый предикат для ленивого TTL-гарда webhook-core и свипа автоджобы
 * (этап 10, ревью: дубль предиката = риск расползания).
 */
export function paymentWindowCutoff(now = Date.now()): Date {
	return new Date(now - paymentWindowMinutes() * 60_000)
}

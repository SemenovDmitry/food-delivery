/**
 * Окно оплаты онлайн-заказа (этап 9, Q17/Q13): минуты от orders.createdAt;
 * просрочка → cancelled_by_timeout. Чтение env по образцу email.ts (zod-env —
 * этап 11): кривое значение → дефолт 5. Отдельный файл: ядро webhook-core
 * импортирует функцию без циркулярной зависимости с фабрикой index.ts.
 */
export function paymentWindowMinutes(): number {
	const raw = Number(process.env.PAYMENT_WINDOW_MINUTES)
	return Number.isFinite(raw) && raw > 0 ? raw : 5
}

/**
 * Момент, до которого окно оплаты живо: `createdAt < cutoff` ⇒ просрочен.
 * Единый предикат для ленивого TTL-гарда webhook-core и свипа автоджобы
 * (этап 10, ревью: дубль предиката = риск расползания).
 */
export function paymentWindowCutoff(now = Date.now()): Date {
	return new Date(now - paymentWindowMinutes() * 60_000)
}

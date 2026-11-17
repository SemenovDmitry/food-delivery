/** Проверка UUID до запроса в БД: Postgres падает на невалидном uuid в where (§5.24) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
	return UUID_RE.test(value)
}

/** Короткий номер заказа для UI/логов/SMS — как «Заказ № {id.slice(0, 8)}» */
export function shortOrderId(orderId: string): string {
	return orderId.slice(0, 8)
}

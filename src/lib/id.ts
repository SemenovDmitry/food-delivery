/** Проверка UUID до запроса в БД: Postgres падает на невалидном uuid в where (§5.23) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
	return UUID_RE.test(value)
}

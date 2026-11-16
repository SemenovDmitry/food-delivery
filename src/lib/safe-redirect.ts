/**
 * Валидация `?redirect=` для auth-потоков (этап 3): только локальные пути «/…»,
 * без «//» (protocol-relative) и схем. Иначе — fallback.
 */
export function safeRedirectPath(value: unknown, fallback = '/orders'): string {
	if (typeof value !== 'string') return fallback
	if (!value.startsWith('/') || value.startsWith('//')) return fallback
	return value
}

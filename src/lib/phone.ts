/**
 * Нормализация RU-телефона в канон сидера `+7 XXX XXX-XX-XX` (этап 3).
 * better-auth сравнивает строки точно (§5.15), сидер хранит `+7 999 000-00-01` —
 * без нормализации вход демо-аккаунтов ломается на формате ввода.
 * Чистая функция без server-only: используется в zod-transform схемы (клиент)
 * и в server actions (сервер парсит ту же схему).
 */
export function normalizeRuPhone(input: string): string | null {
	const digits = input.replace(/\D/g, '')

	let normalized = digits
	// 8XXXXXXXXXX → 7XXXXXXXXXX; 10 цифр без кода страны → префикс 7
	if (normalized.length === 11 && normalized.startsWith('8')) normalized = `7${normalized.slice(1)}`
	if (normalized.length === 10) normalized = `7${normalized}`
	if (normalized.length !== 11 || !normalized.startsWith('7')) return null

	return `+7 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`
}

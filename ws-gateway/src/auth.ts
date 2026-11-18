import { env } from './env.js'
import { logger } from './logger.js'
import type { ChatIdentity } from './protocol.js'

const GUEST_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Кука гостя чата — имя живёт в src/lib/chat.ts на стороне Next (Q2) */
const CHAT_TOKEN_COOKIE = 'chat_token'

/**
 * Origin-проверка (Q7): страница чата живёт на Next (:3000), шлюз на :3001 —
 * браузер шлёт Origin. Не-браузерные клиенты (тесты, wscat) без Origin
 * пропускаются — идентичность всё равно проверяется при апгрейде.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
	if (!origin) return true
	const allowed = env.WS_ALLOWED_ORIGINS.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
	return allowed.includes(origin)
}

function parseCookieHeader(header: string): Map<string, string> {
	const cookies = new Map<string, string>()
	for (const part of header.split(';')) {
		const separator = part.indexOf('=')
		if (separator === -1) continue
		const name = part.slice(0, separator).trim()
		const value = part.slice(separator + 1).trim()
		if (name) cookies.set(name, value)
	}
	return cookies
}

/**
 * Upgrade-аутентификация (§5.22): cookies апгрейд-запроса пересылаются в
 * /api/auth/get-session — куки не изолируются по порту (3000 и 3001 делят их).
 * Оператор admin|manager → identity operator; любой залогиненный → customer;
 * иначе кука chat_token → guest; null = upgrade будет отклонён (401).
 * Падение get-session трактуем как отказ — без Next записи всё равно не идут.
 */
export async function authenticate(cookieHeader: string): Promise<ChatIdentity | null> {
	try {
		const response = await fetch(`${env.NEXT_INTERNAL_URL}/api/auth/get-session`, {
			headers: { cookie: cookieHeader },
		})
		if (response.ok) {
			const session = (await response.json()) as { user?: { id?: string; role?: string } } | null
			const userId = session?.user?.id
			if (userId) {
				const role = session?.user?.role
				if (role === 'admin' || role === 'manager') {
					return { kind: 'operator', userId, role }
				}
				return { kind: 'customer', userId }
			}
		}
	} catch (error) {
		logger.error({ err: error }, 'get-session недоступен')
		return null
	}

	const token = parseCookieHeader(cookieHeader).get(CHAT_TOKEN_COOKIE)
	if (token && GUEST_TOKEN_RE.test(token)) return { kind: 'guest', token }
	return null
}

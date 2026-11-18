import type { Cookie } from '@playwright/test'

/**
 * Хелперы e2e (этап 12, тикет 02): API-логин по телефону (better-auth
 * send-otp + verify — вход, §5.15), рандомные телефоны регистраций (Q4 —
 * изоляция уникальными данными на ран), константы демо-аккаунтов (§4 AGENTS).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export const DEMO = {
	admin: '+7 999 000-00-01',
	manager: '+7 999 000-00-02',
	client: '+7 999 000-00-03',
	smsCode: '1111',
} as const

/** Уникальный телефон на ран: +7 900 XXX-XX-XX (7 случайных цифр) */
export function randomPhone(): string {
	const n = 1_000_000 + Math.floor(Math.random() * 9_000_000)
	const s = String(n)
	return `+7 900 ${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5, 7)}`
}

/**
 * API-логин по телефону → куки сессии для storageState браузер-контекста.
 * SMS не уходит в провайдера — заглушка (код фиксированный, §5.15).
 */
export async function phoneSessionCookies(phone: string, code = DEMO.smsCode): Promise<Cookie[]> {
	const post = (path: string, body: unknown) =>
		fetch(`${BASE_URL}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		})

	const sent = await post('/api/auth/phone-number/send-otp', { phoneNumber: phone })
	if (!sent.ok) {
		throw new Error(`send-otp ${sent.status}: ${await sent.text()}`)
	}
	const verified = await post('/api/auth/phone-number/verify', { phoneNumber: phone, code })
	if (!verified.ok) {
		throw new Error(`verify ${verified.status}: ${await verified.text()}`)
	}

	const setCookies = verified.headers.getSetCookie()
	if (setCookies.length === 0) {
		throw new Error('verify не вернул Set-Cookie — сессии нет')
	}
	return setCookies.map((raw) => {
		const pair = raw.split(';')[0]
		const eq = pair.indexOf('=')
		return {
			name: pair.slice(0, eq),
			value: pair.slice(eq + 1),
			domain: 'localhost',
			path: '/',
			expires: -1,
			httpOnly: true,
			secure: false,
			sameSite: 'Lax',
		} satisfies Cookie
	})
}

/** Логин под демо-аккаунтом → storageState для browser.newContext() */
export async function demoSession(phone: keyof typeof DEMO | string): Promise<{
	cookies: Cookie[]
	origins: []
}> {
	return { cookies: await phoneSessionCookies(phone), origins: [] }
}

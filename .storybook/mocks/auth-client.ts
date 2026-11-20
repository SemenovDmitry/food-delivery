/**
 * Мок @/lib/auth-client для Storybook (слайс 3, тикет 05): настоящий клиент
 * better-auth тянет плагины и fetch-цепочки к /api/auth — в стори-iframe
 * неподняем; Vite-алиас в main.ts подставляет этот файл.
 *
 * ⚠️ Типизация РУЧНАЯ — typeof authClient нецелевой (better-auth-клиент —
 * большой generic-объект с плагинами). В отличие от action-моков, tsc НЕ
 * ловит расхождение с прод-использованием: при вызове нового метода
 * authClient в компоненте дополнить мок руками.
 *
 * Сессия для сторей: __setSession('guest' | 'pending' | user) из декоратора
 * стори (перезапись ДО рендера; stories не перезаютчиваются внутри рендера).
 */
export type SbSessionUser = {
	id: string
	name: string | null
	email: string
	emailVerified: boolean
	role: 'admin' | 'manager' | 'customer'
	phoneNumber: string | null
}

export type SbSessionState = 'guest' | 'pending' | SbSessionUser

let sessionState: SbSessionState = 'guest'

/** Декоратор стори вызывает до рендера: 'guest' | 'pending' | пользователь */
export function __setSession(state: SbSessionState) {
	sessionState = state
}

export const authClient = {
	/** Контракт по использованию в header: { data: { user } | null, isPending } */
	useSession: () => ({
		data: sessionState === 'guest' || sessionState === 'pending' ? null : { user: sessionState },
		isPending: sessionState === 'pending',
	}),
	signOut: async () => ({ success: true }),
	/** Успех всегда; коды ошибок (INVALID_OTP…) — прод-путь, покрыт e2e P1-auth */
	phoneNumber: {
		verify: async (_input: { phoneNumber: string; code: string }) => ({
			data: null,
			error: null as { code?: string } | null,
		}),
	},
	/** Успех всегда; письмо в Mailpit — прод-путь, покрыт приёмкой этапа 3 */
	emailOtp: {
		verifyEmail: async (_input: { email: string; otp: string }) => ({
			data: null,
			error: null as { code?: string } | null,
		}),
	},
}

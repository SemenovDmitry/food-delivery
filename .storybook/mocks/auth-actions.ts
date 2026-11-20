/**
 * Мок server actions auth для Storybook (слайс 3, тикет 05): OTP «уходит»
 * всегда, email привязывается всегда, слияние корзины успешно. Ошибки-гарды
 * («зарегистрируйтесь» и т.п.) — прод-пути, покрыты e2e P1-auth.
 * Сигнатуры — typeof прод-модуля (tsc ловит расхождение).
 */
import type * as AuthActions from '@/lib/actions/auth'

export const sendLoginOtp: typeof AuthActions.sendLoginOtp = async () => ({
	data: null,
	error: null,
})

export const sendRegisterOtp: typeof AuthActions.sendRegisterOtp = async () => ({
	data: null,
	error: null,
})

export const linkEmail: typeof AuthActions.linkEmail = async (email) => ({
	data: { email },
	error: null,
})

export const mergeGuestCartOnAuth: typeof AuthActions.mergeGuestCartOnAuth = async () => ({
	data: null,
	error: null,
})

/** Текст по коду ошибки OTP-endpoint'ов better-auth ($ERROR_CODES плагинов) */
export function otpErrorText(code: string | undefined): string {
	if (code === 'TOO_MANY_ATTEMPTS') return 'Слишком много попыток — отправьте код ещё раз'
	if (code === 'OTP_EXPIRED' || code === 'OTP_NOT_FOUND') return 'Код истёк — отправьте новый'
	if (code === 'INVALID_OTP') return 'Неверный код — проверьте SMS или письмо'
	return 'Не удалось подтвердить код. Попробуйте ещё раз'
}

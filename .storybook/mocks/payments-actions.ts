/**
 * Мок server actions оплаты для Storybook (слайс 3, тикет 05): тумблер
 * провайдера успешен. Сигнатуры — typeof прод-модуля (tsc ловит расхождение).
 */
import type * as PaymentsActions from '@/lib/actions/payments'

export const setPaymentMethodActive: typeof PaymentsActions.setPaymentMethodActive = async (
	code,
	isActive,
) => ({ data: { code, isActive }, error: null })

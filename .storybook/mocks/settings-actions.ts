/**
 * Мок server actions настроек для Storybook (слайс 3, тикет 05): сохранение
 * доставки успешно. Сигнатуры — typeof прод-модуля (tsc ловит расхождение).
 */
import type * as SettingsActions from '@/lib/actions/settings'

export const saveDeliverySettings: typeof SettingsActions.saveDeliverySettings = async () => ({
	data: { saved: true },
	error: null,
})

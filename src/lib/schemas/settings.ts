import { z } from 'zod'

/**
 * Форма «Настройки доставки» (этап 5, Q13): рубли на входе (input step 0.01)
 * → копейки в settings (ключи `delivery_fee`/`free_delivery_threshold`).
 * Чтение остаётся в getDeliverySettings() (шов этапа 1, callers не меняются).
 */
export const deliverySettingsSchema = z.object({
	deliveryFeeRubles: z.coerce
		.number()
		.min(0, 'Не может быть отрицательной')
		.max(100000, 'Слишком большая цена')
		.transform((v) => Math.round(v * 100)),
	freeDeliveryThresholdRubles: z.coerce
		.number()
		.min(0, 'Не может быть отрицательным')
		.max(1000000, 'Слишком большой порог')
		.transform((v) => Math.round(v * 100)),
})

export type DeliverySettingsFormValues = z.infer<typeof deliverySettingsSchema>
export type DeliverySettingsFormInput = z.input<typeof deliverySettingsSchema>

/**
 * Серверная перепроверка (actions): значения уже в копейках (zodResolver
 * отработал на клиенте) — без transform'ов, иначе ×100 дважды (приёмка 5).
 */
export const deliverySettingsServerSchema = z.object({
	deliveryFeeRubles: z.number().int().min(0).max(10000000),
	freeDeliveryThresholdRubles: z.number().int().min(0).max(100000000),
})

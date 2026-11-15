import { z } from 'zod'

/**
 * Схема формы чекаута — единый источник правил валидации:
 * тип формы = z.infer (CheckoutFormValues), клиент — zodResolver,
 * сервер — safeParse в createOrder (клиенту не доверяем, §5.10).
 * zod v4: .trim() применяется ДО последующих проверок (проверено на 4.6.7).
 */
export const checkoutFormSchema = z
	.object({
		customerName: z
			.string()
			.trim()
			.min(2, 'Укажите имя (минимум 2 символа)')
			.max(50, 'Имя слишком длинное'),
		phone: z
			.string()
			.trim()
			.max(20, 'Телефон слишком длинный')
			.refine((value) => value.replace(/\D/g, '').length >= 10, 'Укажите корректный телефон'),
		fulfillment: z.enum(['delivery', 'pickup']),
		address: z.string().trim().max(200, 'Адрес слишком длинный'),
		comment: z.string().trim().max(500, 'Комментарий слишком длинный'),
	})
	// адрес обязателен только для доставки (гриллинг этапа 1, Q6)
	.refine((data) => data.fulfillment === 'pickup' || data.address.trim().length >= 5, {
		error: 'Укажите адрес доставки',
		path: ['address'],
	})

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>

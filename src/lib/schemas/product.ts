import { z } from 'zod'

const setComponentSchema = z.object({
	productId: z.string().min(1, 'Выберите товар'),
	qty: z.coerce.number().int().min(1, 'Минимум 1').max(20, 'Максимум 20'),
})

/**
 * Форма товара (этап 5, Q16). Цена в рублях на входе (input step 0.01) →
 * копейки на выходе — transform, как в настройках доставки (Q13). Состав
 * валидируется только для type=set (superRefine): непустой и без дубликатов.
 */
export const productFormSchema = z
	.object({
		name: z.string().trim().min(1, 'Введите название').max(120, 'Не длиннее 120 символов'),
		description: z.string().trim().max(500, 'Не длиннее 500 символов'),
		priceRubles: z.coerce
			.number()
			.min(1, 'Минимум 1 ₽')
			.max(1000000, 'Слишком большая цена')
			.transform((value) => Math.round(value * 100)),
		type: z.enum(['single', 'set']),
		emoji: z.string().trim().min(1, 'Укажите emoji-фолбэк').max(8, 'Слишком длинно'),
		categoryId: z.coerce.number().int().min(1, 'Выберите категорию'),
		isActive: z.boolean(),
		components: z.array(setComponentSchema).max(20, 'Не больше 20 позиций в составе'),
	})
	.superRefine((data, ctx) => {
		if (data.type !== 'set') return
		if (data.components.length === 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['components'],
				message: 'Добавьте хотя бы один товар в состав',
			})
			return
		}
		const ids = data.components.map((component) => component.productId)
		if (new Set(ids).size !== ids.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['components'],
				message: 'Один товар не может входить в состав дважды',
			})
		}
	})

export type ProductFormValues = z.infer<typeof productFormSchema>
/** Тип ВХОДА формы (priceRubles — строка из input; zodResolver отдаёт выход) */
export type ProductFormInput = z.input<typeof productFormSchema>

const setComponentServerSchema = z.object({
	productId: z.string().min(1),
	qty: z.number().int().min(1).max(20),
})

/**
 * Серверная перепроверка (actions): значения УЖЕ трансформированы клиентской
 * схемой (zodResolver) — здесь только plain-валидаторы БЕЗ transform'ов,
 * иначе ×100 применяется дважды (найдено на приёмке этапа 5: цена 149 ₽
 * превращалась в 14900 ₽). priceRubles — копейки на входе action'а.
 */
export const productServerSchema = z
	.object({
		name: z.string().trim().min(1, 'Введите название').max(120, 'Не длиннее 120 символов'),
		description: z.string().trim().max(500),
		priceRubles: z
			.number()
			.int('Цена — целое число копеек')
			.min(100, 'Минимум 1 ₽')
			.max(100000000, 'Слишком большая цена'),
		type: z.enum(['single', 'set']),
		emoji: z.string().trim().min(1).max(8),
		categoryId: z.number().int().min(1),
		isActive: z.boolean(),
		components: z.array(setComponentServerSchema).max(20),
	})
	.superRefine((data, ctx) => {
		if (data.type !== 'set') return
		if (data.components.length === 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['components'],
				message: 'Добавьте хотя бы один товар в состав',
			})
			return
		}
		const ids = data.components.map((component) => component.productId)
		if (new Set(ids).size !== ids.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['components'],
				message: 'Один товар не может входить в состав дважды',
			})
		}
	})

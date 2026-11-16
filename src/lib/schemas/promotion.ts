import { z } from 'zod'

/** '' | datetime-local → Date | null (окно действия акции) */
const optionalDate = z
	.string()
	.trim()
	.refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Некорректная дата')
	.transform((v) => (v === '' ? null : new Date(v)))

/**
 * Форма акции (этап 5, Q9; условия — задел гриллинга этапа 1). Размер скидки
 * ветвится по типу: percent → целое 1–99, fixed → рубли → копейки (transform).
 * code: пусто → null (акция без кода), иначе промокод в верхнем регистре.
 * categoryId: null = весь заказ; minTotal — рубли на входе, копейки на выходе.
 */
export const promotionFormSchema = z
	.object({
		name: z.string().trim().min(1, 'Введите название').max(120, 'Не длиннее 120 символов'),
		code: z
			.string()
			.trim()
			.toUpperCase()
			.transform((v) => (v === '' ? null : v))
			.pipe(
				z
					.string()
					.regex(/^[A-Z0-9_-]{3,30}$/, 'Латиница, цифры, дефисы; 3–30 символов')
					.nullable(),
			),
		discountType: z.enum(['percent', 'fixed']),
		discountPercent: z.coerce.number().optional(),
		discountRubles: z.coerce.number().optional(),
		categoryId: z.coerce
			.number()
			.int()
			.min(1)
			.optional()
			.transform((v) => (v === undefined ? null : v)),
		minTotalRubles: z.coerce
			.number()
			.min(0)
			.default(0)
			.transform((v) => Math.round(v * 100)),
		startsAt: optionalDate,
		endsAt: optionalDate,
		isActive: z.boolean(),
		isPublic: z.boolean(),
	})
	.superRefine((data, ctx) => {
		if (data.discountType === 'percent') {
			const value = data.discountPercent
			if (value === undefined || !Number.isFinite(value)) {
				ctx.addIssue({ code: 'custom', path: ['discountPercent'], message: 'Укажите процент' })
			} else if (!Number.isInteger(value) || value < 1 || value > 99) {
				ctx.addIssue({
					code: 'custom',
					path: ['discountPercent'],
					message: 'Процент — целое от 1 до 99',
				})
			}
		} else {
			const value = data.discountRubles
			if (value === undefined || !Number.isFinite(value)) {
				ctx.addIssue({ code: 'custom', path: ['discountRubles'], message: 'Укажите сумму скидки' })
			} else if (value <= 0) {
				ctx.addIssue({
					code: 'custom',
					path: ['discountRubles'],
					message: 'Скидка должна быть больше нуля',
				})
			}
		}
		if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
			ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Конец окна раньше начала' })
		}
	})
	.transform((data) => ({
		name: data.name,
		code: data.code,
		discountType: data.discountType,
		discountValue:
			data.discountType === 'percent'
				? Math.round(data.discountPercent ?? 0)
				: Math.round((data.discountRubles ?? 0) * 100),
		categoryId: data.categoryId,
		minTotal: data.minTotalRubles,
		startsAt: data.startsAt,
		endsAt: data.endsAt,
		isActive: data.isActive,
		isPublic: data.isPublic,
	}))

export type PromotionFormInput = z.input<typeof promotionFormSchema>
export type PromotionFormValues = z.output<typeof promotionFormSchema>

/**
 * Серверная перепроверка (actions): значения УЖЕ трансформированы клиентской
 * схемой (zodResolver) — plain-валидаторы без transform'ов, иначе ×100
 * применяется дважды (найдено на приёмке этапа 5, как в productServerSchema).
 */
export const promotionServerSchema = z
	.object({
		name: z.string().trim().min(1, 'Введите название').max(120, 'Не длиннее 120 символов'),
		code: z
			.string()
			.regex(/^[A-Z0-9_-]{3,30}$/, 'Латиница, цифры, дефисы; 3–30 символов')
			.nullable(),
		discountType: z.enum(['percent', 'fixed']),
		discountValue: z.number().int().min(1, 'Скидка должна быть положительной'),
		categoryId: z.number().int().min(1).nullable(),
		minTotal: z.number().int().min(0),
		startsAt: z.date().nullable(),
		endsAt: z.date().nullable(),
		isActive: z.boolean(),
		isPublic: z.boolean(),
	})
	.superRefine((data, ctx) => {
		if (data.discountType === 'percent' && data.discountValue > 99) {
			ctx.addIssue({
				code: 'custom',
				path: ['discountValue'],
				message: 'Процент — целое от 1 до 99',
			})
		}
		if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
			ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Конец окна раньше начала' })
		}
	})

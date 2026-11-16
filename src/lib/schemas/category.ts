import { z } from 'zod'

/**
 * Форма категории (этап 5, Q17). slug обязателен латиницей: он же якорь
 * sticky-навигации главной (#pizza) — URL-видимый идентификатор.
 */
export const categoryFormSchema = z.object({
	name: z.string().trim().min(1, 'Введите название').max(60, 'Не длиннее 60 символов'),
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Латиница, цифры и дефисы, например: pizza')
		.max(40, 'Не длиннее 40 символов'),
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

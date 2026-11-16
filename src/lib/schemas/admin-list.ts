import { z } from 'zod'

/**
 * Общие параметры списков админки (этап 5, Q19): ?page= + ?perPage=.
 * searchParams приходят строками — coerce; мусор и отсутствие — catch на
 * дефолт (страница не должна падать от кривой ссылки). perPage — только
 * 10/25/50 (селектор, Q27); фильтры конкретного списка добавляются отдельно.
 */
export const PER_PAGE_OPTIONS = [10, 25, 50] as const
export type PerPage = (typeof PER_PAGE_OPTIONS)[number]

export const adminListParamsSchema = z.object({
	page: z.coerce.number().int().min(1).catch(1),
	perPage: z.coerce
		.number()
		.pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
		.catch(25),
})

export type AdminListParams = z.infer<typeof adminListParamsSchema>

/** querystring для чипов/пейджера: сохраняет фильтр и perPage, сбрасывает страницу */
export function adminListHref(
	base: string,
	params: { status?: string; q?: string; category?: string; page: number; perPage: number },
): string {
	const qs = new URLSearchParams()
	if (params.status) qs.set('status', params.status)
	if (params.q) qs.set('q', params.q)
	if (params.category) qs.set('category', params.category)
	qs.set('page', String(params.page))
	qs.set('perPage', String(params.perPage))
	return `${base}?${qs.toString()}`
}

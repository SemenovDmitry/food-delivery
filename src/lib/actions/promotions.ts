'use server'

import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import { promotions } from '@/db/schema'
import { type PromotionFormValues, promotionServerSchema } from '@/lib/schemas/promotion'
import { requireAdmin } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/**
 * CRUD акций (этап 5, Q9): удаление разрешено — FK orders.promoId/carts.promoId
 * set null (схема), promoName-снапшот НЕ делается (Q23, осознано).
 * Каждая мутация инвалидирует витринный кеш: updateTag('promos') (§5.29).
 */
function invalidatePromos() {
	updateTag('promos')
	revalidatePath('/')
	revalidatePath('/promo')
	revalidatePath('/cart')
	revalidatePath('/admin/promotions')
}

async function codeTaken(code: string | null, excludeId?: string): Promise<boolean> {
	if (!code) return false
	const rows = await db
		.select({ id: promotions.id })
		.from(promotions)
		.where(
			excludeId
				? and(eq(promotions.code, code), ne(promotions.id, excludeId))
				: eq(promotions.code, code),
		)
	return rows.length > 0
}

function parsedOrError(values: PromotionFormValues) {
	const parsed = promotionServerSchema.safeParse(values)
	if (!parsed.success) {
		return {
			error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы',
			data: null as null | typeof parsed.data,
		}
	}
	return { error: null, data: parsed.data }
}

export async function createPromotion(
	values: PromotionFormValues,
): Promise<ActionResult<{ id: string }>> {
	await requireAdmin()

	const { error, data } = parsedOrError(values)
	if (!data) return { data: null, error }
	if (await codeTaken(data.code)) return { data: null, error: 'Промокод уже занят' }

	const [created] = await db.insert(promotions).values(data).returning({ id: promotions.id })

	invalidatePromos()
	return { data: { id: created.id }, error: null }
}

export async function updatePromotion(
	id: string,
	values: PromotionFormValues,
): Promise<ActionResult<{ id: string }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: 'Акция не найдена' }
	const { error, data } = parsedOrError(values)
	if (!data) return { data: null, error }
	if (await codeTaken(data.code, id)) return { data: null, error: 'Промокод уже занят' }

	await db.update(promotions).set(data).where(eq(promotions.id, id))

	invalidatePromos()
	return { data: { id }, error: null }
}

export async function setPromotionActive(
	id: string,
	isActive: boolean,
): Promise<ActionResult<{ isActive: boolean }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: 'Акция не найдена' }
	await db.update(promotions).set({ isActive }).where(eq(promotions.id, id))

	invalidatePromos()
	return { data: { isActive }, error: null }
}

export async function deletePromotion(id: string): Promise<ActionResult<{ deleted: true }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: 'Акция не найдена' }
	await db.delete(promotions).where(eq(promotions.id, id))

	invalidatePromos()
	return { data: { deleted: true }, error: null }
}

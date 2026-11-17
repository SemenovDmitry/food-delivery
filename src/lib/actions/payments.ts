'use server'

import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { paymentMethods } from '@/db/schema'
import { requireAdminOnly } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/**
 * Тумблер провайдера оплаты (этап 9, Q12/Q14, admin-only — как настройки
 * доставки: влияет на чекаут всего магазина). Выключение последнего активного
 * не блокируется (Q20 — мягкая деградация чекаута), предупреждение — на UI.
 * payment_methods читается везде некешируемо — кеш-теги не нужны.
 */
export async function setPaymentMethodActive(
	code: string,
	isActive: boolean,
): Promise<ActionResult<{ code: string; isActive: boolean }>> {
	await requireAdminOnly()

	const normalized = code.trim()
	if (!normalized) return { data: null, error: 'Способ не найден' }

	const [target] = await db.select().from(paymentMethods).where(eq(paymentMethods.code, normalized))
	if (!target) return { data: null, error: 'Способ не найден' }

	const updated = await db
		.update(paymentMethods)
		.set({ isActive })
		.where(and(eq(paymentMethods.code, normalized), ne(paymentMethods.isActive, isActive)))
		.returning({ code: paymentMethods.code })
	if (updated.length === 0) {
		// гонка: тумблер уже в целевом состоянии — идемпотентный успех
		return { data: { code: normalized, isActive }, error: null }
	}

	revalidatePath('/admin/payments')
	return { data: { code: normalized, isActive }, error: null }
}

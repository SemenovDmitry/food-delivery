'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { settings } from '@/db/schema'
import {
	type DeliverySettingsFormValues,
	deliverySettingsServerSchema,
} from '@/lib/schemas/settings'
import { requireAdminOnly } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/**
 * Сохранение настроек доставки (этап 5, Q13): upsert двух ключей settings.
 * Источник значений для формул — getDeliverySettings() (шов этапа 1),
 * callers не меняются. admin-only: влияет на ценообразование.
 */
export async function saveDeliverySettings(
	values: DeliverySettingsFormValues,
): Promise<ActionResult<{ saved: true }>> {
	await requireAdminOnly()

	const parsed = deliverySettingsServerSchema.safeParse(values)
	if (!parsed.success) {
		return { data: null, error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы' }
	}

	await db.transaction(async (tx) => {
		const upserts = [
			{ key: 'delivery_fee', value: String(parsed.data.deliveryFeeRubles) },
			{ key: 'free_delivery_threshold', value: String(parsed.data.freeDeliveryThresholdRubles) },
		]
		for (const entry of upserts) {
			await tx
				.insert(settings)
				.values({ ...entry, updatedAt: new Date() })
				.onConflictDoUpdate({
					target: settings.key,
					set: { value: entry.value, updatedAt: new Date() },
				})
		}
	})

	revalidatePath('/')
	revalidatePath('/cart')
	revalidatePath('/checkout')
	revalidatePath('/admin/settings')
	return { data: { saved: true }, error: null }
}

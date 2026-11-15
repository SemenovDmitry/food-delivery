import 'server-only'

import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '@/lib/constants'
import type { DeliverySettings } from '@/lib/delivery'

const DELIVERY_KEYS = ['delivery_fee', 'free_delivery_threshold'] as const

/**
 * Настройки доставки из таблицы settings (этап 1, гриллинг 2026-11-15).
 * Отсутствующие/битые ключи — fallback на константы. Динамическое чтение
 * без 'use cache': значения нужны createOrder на каждый заказ. Этап 5
 * добавит админ-форму — источник значений меняется здесь, callers нет.
 */
export async function getDeliverySettings(): Promise<DeliverySettings> {
	const rows = await db
		.select()
		.from(settings)
		.where(inArray(settings.key, [...DELIVERY_KEYS]))

	const byKey = new Map(rows.map((row) => [row.key, Number(row.value)]))
	const fee = byKey.get('delivery_fee')
	const threshold = byKey.get('free_delivery_threshold')

	return {
		deliveryFee: fee !== undefined && fee >= 0 ? fee : DELIVERY_FEE,
		freeDeliveryThreshold:
			threshold !== undefined && threshold >= 0 ? threshold : FREE_DELIVERY_THRESHOLD,
	}
}

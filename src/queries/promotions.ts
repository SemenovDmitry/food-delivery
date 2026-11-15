import { and, asc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { connection } from 'next/server'
import { db } from '@/db'
import type { Promotion } from '@/db/schema'
import { promotions } from '@/db/schema'
import { filterPromosInWindow } from '@/lib/promo'

/**
 * Кешируются ДАННЫЕ витринных акций — isActive=true И isPublic=true (§5.3):
 * все витринные потребители (лента главной, /promo, блок акций корзины,
 * GET /api/promotions) получают только публичные ПО ПОСТРОЕНИЮ — скрытые
 * промокоды (GLOSSARY) не могут утечь забытым фильтром на чтении.
 *
 * Скрытые живут в двух местах мимо этой функции: applyPromoCode (поиск
 * по коду — прямой запрос) и getPromotionById (активное промо корзины).
 * Админке (этап 5) — СВОЙ список без фильтров (getAllPromotions):
 * этой кеш-функцией она не пользуется; мутации акций зовут updateTag('promos').
 */
export async function getCachedActivePromotions(): Promise<Promotion[]> {
	'use cache'
	cacheLife('hours')
	cacheTag('promos')

	return db
		.select()
		.from(promotions)
		.where(and(eq(promotions.isActive, true), eq(promotions.isPublic, true)))
		.orderBy(asc(promotions.createdAt))
}

/**
 * Обёртка без кеша: окно действия проверяется на каждом чтении (акция исчезает ровно в конце окна).
 * `connection()` обязателен: new Date() — синхронное IO, при пререндере Suspense сам его не спрячет
 * (docs/cache-components: «wrap in Suspense AND call connection() before the call»).
 */
export async function getActivePromotions(): Promise<Promotion[]> {
	// connection() ПЕРВЫМ: всё после него уходит в рантайм — иначе кеш-функция
	// исполнится на пререндере сборки и потребует живую БД (§5.3)
	await connection()
	const promos = await getCachedActivePromotions()
	return filterPromosInWindow(promos, new Date())
}

/**
 * Сырая акция по id — для активного промо корзины: читаем независимо от
 * окна/активности, валидность на рендере решает calcDiscount (тикет 04).
 */
export async function getPromotionById(id: string): Promise<Promotion | null> {
	const [found] = await db.select().from(promotions).where(eq(promotions.id, id))
	return found ?? null
}

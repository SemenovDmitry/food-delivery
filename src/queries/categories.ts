import { asc, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'

export type AdminCategoryRow = {
	id: number
	slug: string
	name: string
	position: number
	productCount: number
}

/** Все категории с числом товаров — /admin/categories (этап 5). Без кеша: админские данные */
export async function getCategoriesWithCounts(): Promise<AdminCategoryRow[]> {
	return await db
		.select({
			id: categories.id,
			slug: categories.slug,
			name: categories.name,
			position: categories.position,
			productCount: count(products.id),
		})
		.from(categories)
		.leftJoin(products, eq(products.categoryId, categories.id))
		.groupBy(categories.id)
		.orderBy(asc(categories.position), asc(categories.id))
}

/** Простые списки для select'ов форм (этап 5) */
export async function getCategoriesSimple() {
	return await db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
		.orderBy(asc(categories.position), asc(categories.id))
}

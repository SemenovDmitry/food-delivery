import { asc, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products, setItems } from '@/db/schema'

export type AdminProductRow = {
	id: string
	name: string
	emoji: string
	price: number
	type: string
	isActive: boolean
	position: number
	categoryId: number
	categoryName: string
}

/** Список товаров для /admin/products (этап 5): порядок витрины, join категории */
export async function getAdminProducts({
	categoryId,
	page,
	perPage,
}: {
	categoryId: number | null
	page: number
	perPage: number
}): Promise<{
	rows: AdminProductRow[]
	total: number
}> {
	const where = categoryId ? eq(products.categoryId, categoryId) : undefined

	const rows = await db
		.select({
			id: products.id,
			name: products.name,
			emoji: products.emoji,
			price: products.price,
			type: products.type,
			isActive: products.isActive,
			position: products.position,
			categoryId: products.categoryId,
			categoryName: categories.name,
		})
		.from(products)
		.innerJoin(categories, eq(products.categoryId, categories.id))
		.where(where)
		.orderBy(asc(categories.position), asc(products.position), asc(products.id))
		.limit(perPage)
		.offset((page - 1) * perPage)

	const [{ value: total }] = await db.select({ value: count() }).from(products).where(where)

	return { rows, total }
}

export type AdminSetComponent = {
	productId: string
	name: string
	price: number
	qty: number
}

/** Товар + состав для формы редактирования; null = не найден */
export async function getAdminProduct(id: string): Promise<{
	product: typeof products.$inferSelect
	components: AdminSetComponent[]
} | null> {
	const [product] = await db.select().from(products).where(eq(products.id, id))
	if (!product) return null

	const components =
		product.type === 'set'
			? await db
					.select({
						productId: setItems.productId,
						name: products.name,
						price: products.price,
						qty: setItems.qty,
					})
					.from(setItems)
					.innerJoin(products, eq(setItems.productId, products.id))
					.where(eq(setItems.setId, product.id))
					.orderBy(asc(setItems.id))
			: []

	return { product, components }
}

/** Все товары категории в порядке витрины — режим DnD-сортировки (Q26) */
export async function getCategoryProducts(categoryId: number) {
	return await db
		.select({
			id: products.id,
			name: products.name,
			emoji: products.emoji,
			price: products.price,
			type: products.type,
			isActive: products.isActive,
		})
		.from(products)
		.where(eq(products.categoryId, categoryId))
		.orderBy(asc(products.position), asc(products.id))
}

/** Простые списки для select'ов формы (категории, кандидаты состава) */
export async function getProductsSimple() {
	return await db
		.select({ id: products.id, name: products.name, type: products.type })
		.from(products)
		.orderBy(asc(products.name))
}

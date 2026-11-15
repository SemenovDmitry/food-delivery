import { asc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db'
import type { Product } from '@/db/schema'
import { categories, products, setItems } from '@/db/schema'
import { isUuid } from '@/lib/id'

export type MenuSetComponent = {
	productId: string
	name: string
	price: number
	emoji: string
	qty: number
}

export type MenuProduct = Product & {
	setComponents: MenuSetComponent[]
	/** сумма цен компонентов — зачёркнутая старая цена сета (GLOSSARY «Сет») */
	setOldPrice: number | null
}

export type MenuCategory = {
	id: number
	slug: string
	name: string
	products: MenuProduct[]
}

/**
 * Полное меню: категории + товары + составы сетов.
 * Кешируется: 'use cache' + hours + тег `menu`; после мутаций меню — revalidateTag('menu') (§5.3).
 */
export async function getFullMenu(): Promise<MenuCategory[]> {
	'use cache'
	cacheLife('hours')
	cacheTag('menu')

	const cats = await db.select().from(categories).orderBy(asc(categories.id))
	const allProducts = await db
		.select()
		.from(products)
		.orderBy(asc(products.price), asc(products.name))
	const items = await db
		.select({
			setId: setItems.setId,
			productId: setItems.productId,
			qty: setItems.qty,
			name: products.name,
			price: products.price,
			emoji: products.emoji,
		})
		.from(setItems)
		.innerJoin(products, eq(setItems.productId, products.id))

	const componentsBySet = new Map<string, MenuSetComponent[]>()
	for (const item of items) {
		const list = componentsBySet.get(item.setId) ?? []
		list.push({
			productId: item.productId,
			name: item.name,
			price: item.price,
			emoji: item.emoji,
			qty: item.qty,
		})
		componentsBySet.set(item.setId, list)
	}

	return cats.map((cat) => ({
		id: cat.id,
		slug: cat.slug,
		name: cat.name,
		products: allProducts
			.filter((p) => p.categoryId === cat.id)
			.map((p): MenuProduct => {
				if (p.type !== 'set') {
					return { ...p, setComponents: [], setOldPrice: null }
				}
				const components = componentsBySet.get(p.id) ?? []
				const oldPrice = components.reduce((sum, c) => sum + c.price * c.qty, 0)
				return { ...p, setComponents: components, setOldPrice: oldPrice }
			}),
	}))
}

/** Один товар с составом (для страницы/модалки товара); кешируется с тегом `menu` */
export async function getProduct(id: string): Promise<MenuProduct | null> {
	'use cache'
	cacheLife('hours')
	cacheTag('menu')

	// невалидный uuid (обрезанная ссылка) роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(id)) return null

	const [product] = await db.select().from(products).where(eq(products.id, id))
	if (!product) return null

	const components =
		product.type === 'set'
			? await db
					.select({
						productId: setItems.productId,
						qty: setItems.qty,
						name: products.name,
						price: products.price,
						emoji: products.emoji,
					})
					.from(setItems)
					.innerJoin(products, eq(setItems.productId, products.id))
					.where(eq(setItems.setId, product.id))
			: []

	const oldPrice = components.reduce((sum, c) => sum + c.price * c.qty, 0)
	return {
		...product,
		setComponents: product.type === 'set' ? components : [],
		setOldPrice: product.type === 'set' ? oldPrice : null,
	}
}

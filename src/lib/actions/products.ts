'use server'

import { count, desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import { categories, products, setItems } from '@/db/schema'
import { plural } from '@/lib/format'
import { type ProductFormValues, productServerSchema } from '@/lib/schemas/product'
import { requireAdmin } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/**
 * CRUD товаров (этап 5, Q16/Q26). Мутации инвалидируют витрину:
 * updateTag('menu') + revalidatePath (§5.29). Позиция НЕ меняется при
 * редактировании — только reorder (DnD) и create (в конец категории).
 */
function invalidateCatalog() {
	updateTag('menu')
	revalidatePath('/')
	revalidatePath('/admin/products')
}

/** Общая серверная валидация формы: категория и состав существуют */
async function validateReferences(
	values: ProductFormValues,
	selfId?: string,
): Promise<string | null> {
	const [category] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.id, values.categoryId))
	if (!category) return 'Категория не найдена'

	if (values.type === 'set' && values.components.length > 0) {
		const ids = values.components.map((component) => component.productId)
		if (selfId && ids.includes(selfId)) {
			return 'Сет не может включать сам себя в состав'
		}
		const found = await db
			.select({ id: products.id })
			.from(products)
			.where(inArray(products.id, [...new Set(ids)]))
		if (found.length !== new Set(ids).size) return 'Некоторые товары состава не найдены'
	}
	return null
}

function parsedOrError(values: ProductFormValues) {
	const parsed = productServerSchema.safeParse(values)
	if (!parsed.success) {
		return {
			error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы',
			data: null as null | typeof parsed.data,
		}
	}
	return { error: null, data: parsed.data }
}

export async function createProduct(
	values: ProductFormValues,
): Promise<ActionResult<{ id: string }>> {
	await requireAdmin()

	const { error, data } = parsedOrError(values)
	if (!data) return { data: null, error }
	const refError = await validateReferences(data)
	if (refError) return { data: null, error: refError }

	// новый товар — в конец своей категории (Q26)
	const [last] = await db
		.select({ position: products.position })
		.from(products)
		.where(eq(products.categoryId, data.categoryId))
		.orderBy(desc(products.position))
		.limit(1)

	const id = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(products)
			.values({
				categoryId: data.categoryId,
				name: data.name,
				description: data.description || null,
				price: data.priceRubles,
				type: data.type,
				emoji: data.emoji,
				isActive: data.isActive,
				position: (last?.position ?? -1) + 1,
			})
			.returning({ id: products.id })

		if (data.type === 'set' && data.components.length > 0) {
			await tx.insert(setItems).values(
				data.components.map((component) => ({
					setId: created.id,
					productId: component.productId,
					qty: component.qty,
				})),
			)
		}
		return created.id
	})

	invalidateCatalog()
	return { data: { id }, error: null }
}

export async function updateProduct(
	id: string,
	values: ProductFormValues,
): Promise<ActionResult<{ id: string }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: 'Товар не найден' }
	const { error, data } = parsedOrError(values)
	if (!data) return { data: null, error }
	const refError = await validateReferences(data, id)
	if (refError) return { data: null, error: refError }

	await db.transaction(async (tx) => {
		await tx
			.update(products)
			.set({
				categoryId: data.categoryId,
				name: data.name,
				description: data.description || null,
				price: data.priceRubles,
				type: data.type,
				emoji: data.emoji,
				isActive: data.isActive,
				updatedAt: new Date(),
				// position не трогаем: порядок меняет только DnD (Q26)
			})
			.where(eq(products.id, id))

		// состав пересоздаётся (паттерн сидера): уход из set — состав пустеет
		await tx.delete(setItems).where(eq(setItems.setId, id))
		if (data.type === 'set' && data.components.length > 0) {
			await tx.insert(setItems).values(
				data.components.map((component) => ({
					setId: id,
					productId: component.productId,
					qty: component.qty,
				})),
			)
		}
	})

	invalidateCatalog()
	return { data: { id }, error: null }
}

/**
 * Деактивация (Q16): скрывает из каталога (getFullMenu фильтр isActive),
 * корзину НЕ трогает — снятый с меню товар, лежащий у кого-то, заказываем.
 */
export async function setProductActive(
	id: string,
	isActive: boolean,
): Promise<ActionResult<{ isActive: boolean }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: 'Товар не найден' }
	const [found] = await db.select({ id: products.id }).from(products).where(eq(products.id, id))
	if (!found) return { data: null, error: 'Товар не найден' }

	await db.update(products).set({ isActive, updatedAt: new Date() }).where(eq(products.id, id))

	invalidateCatalog()
	return { data: { isActive }, error: null }
}

/**
 * Удаление хард (Q16): cart_items исчезают каскадом, order_items переживают
 * (снапшот + set null). Единственный стопор — состав сетов (FK restrict):
 * явная ошибка вместо молчаливой поломки чужих сетов.
 */
export async function deleteProduct(id: string): Promise<ActionResult<{ deleted: true }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: 'Товар не найден' }

	const [{ value: setCount }] = await db
		.select({ value: count() })
		.from(setItems)
		.where(eq(setItems.productId, id))
	if (setCount > 0) {
		return {
			data: null,
			error: `Товар входит в ${setCount} ${plural(setCount, 'сет', 'сета', 'сетов')} — сначала уберите его из состава`,
		}
	}

	await db.delete(products).where(eq(products.id, id))

	invalidateCatalog()
	return { data: { deleted: true }, error: null }
}

/** Порядок внутри категории после DnD (Q26): position = индекс присланного массива */
export async function reorderProducts(
	categoryId: number,
	ids: string[],
): Promise<ActionResult<{ reordered: number }>> {
	await requireAdmin()

	if (!Number.isInteger(categoryId) || categoryId < 1) {
		return { data: null, error: 'Категория не найдена' }
	}
	if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
		return { data: null, error: 'Некорректный порядок товаров' }
	}

	await db.transaction(async (tx) => {
		for (const [position, id] of ids.entries()) {
			await tx.update(products).set({ position, updatedAt: new Date() }).where(eq(products.id, id))
		}
	})

	invalidateCatalog()
	return { data: { reordered: ids.length }, error: null }
}

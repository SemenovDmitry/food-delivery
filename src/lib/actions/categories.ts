'use server'

import { and, count, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { plural } from '@/lib/format'
import { type CategoryFormValues, categoryFormSchema } from '@/lib/schemas/category'
import { requireAdmin } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

/**
 * CRUD категорий (этап 5, Q17). Все мутации инвалидируют кеш витрины:
 * updateTag('menu') — read-your-own-writes (§5.3/§5.29) — витрина и
 * sticky-навигация строятся из getFullMenu с этим тегом.
 */
function invalidateCatalog() {
	updateTag('menu')
	revalidatePath('/')
	revalidatePath('/admin/categories')
}

async function slugTaken(slug: string, excludeId?: number): Promise<boolean> {
	const rows = await db
		.select({ id: categories.id })
		.from(categories)
		.where(
			excludeId
				? and(eq(categories.slug, slug), ne(categories.id, excludeId))
				: eq(categories.slug, slug),
		)
	return rows.length > 0
}

export async function createCategory(
	values: CategoryFormValues,
): Promise<ActionResult<{ id: number }>> {
	await requireAdmin()

	const parsed = categoryFormSchema.safeParse(values)
	if (!parsed.success) {
		return { data: null, error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы' }
	}
	if (await slugTaken(parsed.data.slug)) {
		return { data: null, error: 'Категория с таким slug уже есть' }
	}

	// позиция новой — в конец списка (Q26)
	const [last] = await db
		.select({ position: categories.position })
		.from(categories)
		.orderBy(desc(categories.position))
		.limit(1)

	const [created] = await db
		.insert(categories)
		.values({ ...parsed.data, position: (last?.position ?? -1) + 1 })
		.returning({ id: categories.id })

	invalidateCatalog()
	return { data: { id: created.id }, error: null }
}

export async function updateCategory(
	id: number,
	values: CategoryFormValues,
): Promise<ActionResult<{ id: number }>> {
	await requireAdmin()

	if (!Number.isInteger(id) || id < 1) return { data: null, error: 'Категория не найдена' }
	const parsed = categoryFormSchema.safeParse(values)
	if (!parsed.success) {
		return { data: null, error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы' }
	}
	if (await slugTaken(parsed.data.slug, id)) {
		return { data: null, error: 'Категория с таким slug уже есть' }
	}

	await db.update(categories).set(parsed.data).where(eq(categories.id, id))

	invalidateCatalog()
	return { data: { id }, error: null }
}

/**
 * Сохранение порядка после DnD (Q25/Q26): position = индекс в присланном
 * массиве (заодно нормализует дыры 0..n-1). Транзакция — порядок либо весь,
 * либо никак.
 */
export async function reorderCategories(
	ids: number[],
): Promise<ActionResult<{ reordered: number }>> {
	await requireAdmin()

	if (
		!Array.isArray(ids) ||
		ids.length === 0 ||
		ids.some((id) => !Number.isInteger(id) || id < 1)
	) {
		return { data: null, error: 'Некорректный порядок категорий' }
	}

	await db.transaction(async (tx) => {
		for (const [position, id] of ids.entries()) {
			await tx.update(categories).set({ position }).where(eq(categories.id, id))
		}
	})

	invalidateCatalog()
	return { data: { reordered: ids.length }, error: null }
}

/** Удаление с гвардом: категория с товарами не удаляется (FK restrict → осмысленная ошибка) */
export async function deleteCategory(id: number): Promise<ActionResult<{ deleted: true }>> {
	await requireAdmin()

	if (!Number.isInteger(id) || id < 1) return { data: null, error: 'Категория не найдена' }

	const [{ value: productCount }] = await db
		.select({ value: count() })
		.from(products)
		.where(eq(products.categoryId, id))
	if (productCount > 0) {
		return {
			data: null,
			error: `В категории ${productCount} ${plural(productCount, 'товар', 'товара', 'товаров')} — сначала перенесите или удалите их`,
		}
	}

	await db.delete(categories).where(eq(categories.id, id))

	invalidateCatalog()
	return { data: { deleted: true }, error: null }
}

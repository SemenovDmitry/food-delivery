/**
 * Мок server actions категорий для Storybook (слайс 3, тикет 05): CRUD и
 * переупорядочивание успешны. Сигнатуры — typeof прод-модуля (tsc ловит
 * расхождение).
 */
import type * as CategoriesActions from '@/lib/actions/categories'

export const createCategory: typeof CategoriesActions.createCategory = async () => ({
	data: { id: 99 },
	error: null,
})

export const updateCategory: typeof CategoriesActions.updateCategory = async (id) => ({
	data: { id },
	error: null,
})

export const reorderCategories: typeof CategoriesActions.reorderCategories = async (ids) => ({
	data: { reordered: ids.length },
	error: null,
})

export const deleteCategory: typeof CategoriesActions.deleteCategory = async () => ({
	data: { deleted: true },
	error: null,
})

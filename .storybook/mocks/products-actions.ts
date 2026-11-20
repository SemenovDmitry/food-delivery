/**
 * Мок server actions товаров для Storybook (слайс 3, тикет 05): CRUD, тумблер
 * активности и переупорядочивание успешны. Сигнатуры — typeof прод-модуля
 * (tsc ловит расхождение).
 */
import type * as ProductsActions from '@/lib/actions/products'

export const createProduct: typeof ProductsActions.createProduct = async () => ({
	data: { id: '99999999-1111-1111-1111-111111111111' },
	error: null,
})

export const updateProduct: typeof ProductsActions.updateProduct = async (id) => ({
	data: { id },
	error: null,
})

export const setProductActive: typeof ProductsActions.setProductActive = async (_id, isActive) => ({
	data: { isActive },
	error: null,
})

export const deleteProduct: typeof ProductsActions.deleteProduct = async () => ({
	data: { deleted: true },
	error: null,
})

export const reorderProducts: typeof ProductsActions.reorderProducts = async (ids) => ({
	data: { reordered: ids.length },
	error: null,
})

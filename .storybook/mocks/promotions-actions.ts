/**
 * Мок server actions акций для Storybook (слайс 3, тикет 05): CRUD и тумблер
 * успешны. Сигнатуры — typeof прод-модуля (tsc ловит расхождение).
 */
import type * as PromotionsActions from '@/lib/actions/promotions'

export const createPromotion: typeof PromotionsActions.createPromotion = async () => ({
	data: { id: 'aaaaaaaa-9999-9999-9999-999999999999' },
	error: null,
})

export const updatePromotion: typeof PromotionsActions.updatePromotion = async (id) => ({
	data: { id },
	error: null,
})

export const setPromotionActive: typeof PromotionsActions.setPromotionActive = async (
	_id,
	isActive,
) => ({ data: { isActive }, error: null })

export const deletePromotion: typeof PromotionsActions.deletePromotion = async () => ({
	data: { deleted: true },
	error: null,
})

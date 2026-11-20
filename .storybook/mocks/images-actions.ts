/**
 * Мок server actions картинок для Storybook (слайс 3, тикет 05): upload
 * «загружает» мгновенно (success-ветка обязана вернуть реальную форму data —
 * не null, это ActionResult-дискриминант), remove успешен. Сигнатуры —
 * typeof прод-модуля (tsc ловит расхождение).
 */
import type * as ImagesActions from '@/lib/actions/images'

export const uploadProductImage: typeof ImagesActions.uploadProductImage = async () => ({
	data: { imageUrl: '/mock-image.webp', src: null },
	error: null,
})

export const removeProductImage: typeof ImagesActions.removeProductImage = async () => ({
	data: { removed: true },
	error: null,
})

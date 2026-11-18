import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { cartLines, cartPromoSecret, cartPromoShawarma } from './fixtures'
import { PromoBlock } from './promo-block'

/**
 * Промо-блок /cart: применение кнопкой, снятие ✕, причины неприменимости,
 * кастомный код плашкой (этап 1, ретро). applyPromoCode/removePromoCode
 * замоканы алиасом — клик даёт тост успеха.
 */
const meta = {
	title: 'Shop/PromoBlock',
	component: PromoBlock,
	args: {
		lines: cartLines,
		promoQuery: '',
	},
} satisfies Meta<typeof PromoBlock>
export default meta
type Story = StoryObj<typeof meta>

/** Доступная акция — кнопка «Применить» и сумма скидки */
export const Available: Story = {
	args: { activePromo: null, availablePromos: [cartPromoShawarma] },
}

/** Активная — карточка подсвечена, кнопка заменена ✕ */
export const ActiveInList: Story = {
	args: { activePromo: cartPromoShawarma, availablePromos: [cartPromoShawarma] },
}

/** Кастомный код (нет в списке) — плашка с кодом и скидкой */
export const CustomCodePlate: Story = {
	args: { activePromo: cartPromoSecret, availablePromos: [cartPromoShawarma] },
}

/** Невалидное по состоянию (сервер посчитал stateReason) — деструктивная причина */
export const StalePromo: Story = {
	args: {
		activePromo: { ...cartPromoShawarma, stateReason: 'Срок действия промокода истёк' },
		availablePromos: [cartPromoShawarma],
	},
}

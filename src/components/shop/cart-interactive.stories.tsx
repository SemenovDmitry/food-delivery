import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CartInteractive } from './cart-interactive'
import { cartLines, cartPromoShawarma, deliverySettings } from './fixtures'

/**
 * Интерактив /cart: optimistic-степперы/удаление, Tabs, тоталы (§5.10).
 * Действия setQty/removeFromCart замоканы алиасом (.storybook/mocks/cart-actions).
 */
const meta = {
	title: 'Shop/CartInteractive',
	component: CartInteractive,
	args: {
		activePromo: null,
		availablePromos: [cartPromoShawarma],
		delivery: deliverySettings,
		promoQuery: '',
	},
} satisfies Meta<typeof CartInteractive>
export default meta
type Story = StoryObj<typeof meta>

/** Полная корзина без промо: подсказка «до бесплатной доставки» (1270 > 1000 → бесплатная) */
export const FullCart: Story = { args: { lines: cartLines } }

/** Со скоуп-скидкой: −136 ₽ от шаурмы, строка «Скидка (−20% на всю шаурму)» */
export const WithPromo: Story = {
	args: { lines: cartLines, activePromo: cartPromoShawarma },
}

/** Пустая корзина: кнопка оформления дизейблится */
export const Empty: Story = { args: { lines: [] } }

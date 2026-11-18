import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { OrderTotals } from './order-totals'

/** Единый блок тоталов: Товары / Скидка / Доставка / Итого (ревью S3) */
const meta = {
	title: 'Shop/OrderTotals',
	component: OrderTotals,
} satisfies Meta<typeof OrderTotals>
export default meta
type Story = StoryObj<typeof meta>

/** Без скидки, платная доставка */
export const NoDiscount: Story = {
	args: {
		subtotal: 119000,
		discountAmount: 0,
		discountLabel: null,
		deliveryCost: 19900,
		isPickup: false,
	},
}

/** Скоуп-скидка (SHAWARMA20, −136 ₽) + бесплатная доставка (1270 ≥ 1000) */
export const WithDiscount: Story = {
	args: {
		subtotal: 127000,
		discountAmount: 13600,
		discountLabel: '−20% на всю шаурму',
		deliveryCost: 0,
		isPickup: false,
	},
}

/** Самовывоз — доставки нет */
export const Pickup: Story = {
	args: {
		subtotal: 59000,
		discountAmount: 0,
		discountLabel: null,
		deliveryCost: 0,
		isPickup: true,
	},
}

/** Fixed-скидка на весь заказ (SECRET15-стиль) */
export const FixedDiscount: Story = {
	args: {
		subtotal: 127000,
		discountAmount: 15000,
		discountLabel: '−150 ₽ на сеты',
		deliveryCost: 19900,
		isPickup: false,
	},
}

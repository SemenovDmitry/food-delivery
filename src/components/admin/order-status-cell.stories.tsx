import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { OrderStatus } from '@/db/schema'
import { OrderStatusCell } from './order-status-cell'

/**
 * Inline-смена статуса в /admin/orders (этап 5, Q10; гвард неоплаченного
 * онлайн — этап 9, Q18): updateOrderStatus замокан алиасом
 * (.storybook/mocks/order-actions — эхо статуса). Открытый dropdown —
 * интеракция.
 */
const meta = {
	title: 'Admin/OrderStatusCell',
	component: OrderStatusCell,
	args: { orderId: '68dbbfbd-1111-2222-3333-444444444444' },
} satisfies Meta<typeof OrderStatusCell>
export default meta
type Story = StoryObj<typeof meta>

/** Готовится (доставка): select с легальными переходами ready/in_delivery/… */
export const Preparing: Story = {
	args: {
		status: 'preparing' satisfies OrderStatus,
		fulfillment: 'delivery',
		paymentMethod: 'on_receipt',
		paymentStatus: 'pending',
	},
}

/** Неоплаченный онлайн: из опций только «Отменено заведением» + подпись
 * «Ожидает оплаты» (кухня не стартует — select НЕ дизейблится целиком, Q18) */
export const UnpaidOnline: Story = {
	args: {
		status: 'created' satisfies OrderStatus,
		fulfillment: 'delivery',
		paymentMethod: 'online',
		paymentStatus: 'pending',
	},
}

/** Доставлен (терминальный): легальных переходов нет — select задизейблен */
export const Delivered: Story = {
	args: {
		status: 'delivered' satisfies OrderStatus,
		fulfillment: 'delivery',
		paymentMethod: 'on_receipt',
		paymentStatus: 'paid',
	},
}

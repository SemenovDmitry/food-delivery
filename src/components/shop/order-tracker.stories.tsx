import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useEffect } from 'react'
import { OrderTracker } from './order-tracker'

/**
 * Трекинг (этап 4/9): бейдж статуса, платёжный чип, баннер отмены.
 * Поллинг 25 с заморожен декоратором (fetch /api/orders/* возвращает тот же
 * статус молча — как 304); живой поллинг ≤35 с покрыт e2e (P2-2). Состояния —
 * через args: props и есть «смена статуса» в стори.
 */
const meta = {
	title: 'Shop/OrderTracker',
	component: OrderTracker,
	args: {
		orderId: '64fdb271-6b53-4c38-9a7c-0f8ca1e77e33',
		initialPaymentMethod: 'on_receipt',
		initialPaymentStatus: 'pending',
		updatedAt: new Date().toISOString(),
	},
	decorators: [
		(Story) => {
			useEffect(() => {
				const original = window.fetch
				window.fetch = async (input, init) => {
					const url =
						typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
					if (url.includes('/api/orders/')) {
						return new Response('{}', { headers: { 'content-type': 'application/json' } })
					}
					return original(input, init)
				}
				return () => {
					window.fetch = original
				}
			}, [])
			return <Story />
		},
	],
} satisfies Meta<typeof OrderTracker>
export default meta
type Story = StoryObj<typeof meta>

/** Только что создан (on_receipt): «При получении», кнопка отмены */
export const CreatedOnReceipt: Story = { args: { initialStatus: 'created' } }

/** Неоплаченный онлайн: чип «Ожидает оплаты» + CTA на pay-страницу (этап 9) */
export const UnpaidOnline: Story = {
	args: {
		initialStatus: 'created',
		initialPaymentMethod: 'online',
		initialPaymentStatus: 'pending',
	},
}

/** Оплаченный онлайн: чип «Оплачено» */
export const PaidOnline: Story = {
	args: {
		initialStatus: 'preparing',
		initialPaymentMethod: 'online',
		initialPaymentStatus: 'paid',
	},
}

/** В доставке */
export const InDelivery: Story = { args: { initialStatus: 'in_delivery' } }

/** Доставлен — терминальный, поллинг замолкает */
export const Delivered: Story = { args: { initialStatus: 'delivered' } }

/** Отменён клиентом — destructive-баннер ВМЕСТО таймлайна (4-бис) */
export const CancelledByCustomer: Story = { args: { initialStatus: 'cancelled_by_customer' } }

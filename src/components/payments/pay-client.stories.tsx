import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PayClient } from './pay-client'

/**
 * Pay-страница без шапки магазина (этап 9): (provider) route group. Все стори —
 * пропс-пиннable ветки шага 1; POST /api/payments/mock/confirm не стрифицируем
 * (клики не стори — живой loopback-webhook покрыт e2e P2-платежи). Отклонение
 * от матрицы спеки: сторь «Повтор после failed» снята — плашка повтора
 * рендерится только на шаге 2 (interaction-only), статично невидима.
 */
const meta = {
	title: 'Payments/PayClient',
	component: PayClient,
	args: {
		orderId: '68dbbfbd-1111-2222-3333-444444444444',
		amount: 123400,
		// createdAt = момент загрузки стори → отсчёт стартует с полных 5:00
		createdAtIso: new Date(Date.now()).toISOString(),
		windowMinutes: 5,
		paymentStatus: 'pending',
	},
} satisfies Meta<typeof PayClient>
export default meta
type Story = StoryObj<typeof meta>

/** Шаг 1 «Выберите банк»: radio без выбора, «Продолжить» дизейблится до выбора */
export const BankSelection: Story = {
	args: {
		providers: [
			{ code: 'sber', label: 'Сбер' },
			{ code: 'unionpay', label: 'UnionPay' },
		],
	},
}

/** Оба провайдера выключены админом (Q20): мягкая деградация чекаута */
export const NoProviders: Story = { args: { providers: [] } }

/** Окно оплаты истекло: заказ уйдёт в cancelled_by_timeout, кнопки дизейблятся */
export const Expired: Story = {
	args: {
		providers: [
			{ code: 'sber', label: 'Сбер' },
			{ code: 'unionpay', label: 'UnionPay' },
		],
		createdAtIso: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
	},
}

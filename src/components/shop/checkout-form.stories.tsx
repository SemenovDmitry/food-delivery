import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CheckoutForm } from './checkout-form'
import { cartLines, deliverySettings } from './fixtures'

/**
 * Чекаут (RHF+zod): inline-валидация после blur, серверные ошибки — Dialog.
 * createOrder замокан алиасом (.storybook/mocks/order-actions) — submit
 * проходит и «уходит» на мок-заказ.
 */
const meta = {
	title: 'Shop/CheckoutForm',
	component: CheckoutForm,
	args: {
		lines: cartLines,
		activePromo: null,
		delivery: deliverySettings,
		initialFulfillment: 'delivery',
		initialName: '',
		initialPhone: '',
		hasActiveProviders: true,
	},
} satisfies Meta<typeof CheckoutForm>
export default meta
type Story = StoryObj<typeof meta>

/** Пустая форма гостя: поставьте фокус и уберите — inline-ошибка (mode: onTouched) */
export const EmptyGuestForm: Story = {}

/** Зарегистрированный: prefill из сессии */
export const PrefilledFromSession: Story = {
	args: { initialName: 'Дмитрий', initialPhone: '+7 999 000-00-03' },
}

/** Онлайн доступен: prefill из сессии + radio «Онлайн-оплата» */
export const OnlineAvailable: Story = {
	args: { initialName: 'Дмитрий', initialPhone: '+7 999 000-00-03' },
}

/** Провайдеры выключены админом (Q20) — radio онлайн скрыт */
export const OnlineHidden: Story = { args: { hasActiveProviders: false } }

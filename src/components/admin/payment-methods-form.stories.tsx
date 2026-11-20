import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PaymentMethodsForm } from './payment-methods-form'

/**
 * Тумблеры провайдеров оплаты (этап 9, Q14/Q20): setPaymentMethodActive
 * замокан алиасом (.storybook/mocks/payments-actions — успех); выключение
 * последнего активного — toast.warning, интеракция. Канон сидера — оба
 * активны.
 */
const meta = {
	title: 'Admin/PaymentMethodsForm',
	component: PaymentMethodsForm,
} satisfies Meta<typeof PaymentMethodsForm>
export default meta
type Story = StoryObj<typeof meta>

/** Сбер + UnionPay активны («Доступен в чекауте») */
export const Providers: Story = {
	args: {
		providers: [
			{ code: 'sber', label: 'Сбер', isActive: true },
			{ code: 'unionpay', label: 'UnionPay', isActive: true },
		],
	},
}

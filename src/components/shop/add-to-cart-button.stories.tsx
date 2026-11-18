import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AddToCartButton } from './add-to-cart-button'

/**
 * Кнопка «В корзину»: server action + useOptimistic + toast (§11).
 * Действие замокано алиасом (.storybook/mocks/cart-actions) — клик даёт
 * тост успеха и мгновенный optimistic-pending.
 */
const meta = {
	title: 'Shop/AddToCartButton',
	component: AddToCartButton,
	args: { productId: '11111111-1111-1111-1111-111111111111' },
} satisfies Meta<typeof AddToCartButton>
export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {}

/** Крупная на всю ширину — карточка товара */
export const LargeFullWidth: Story = { args: { size: 'lg', fullWidth: true } }

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { margherita, shawarmaForTwo } from './fixtures'
import { ProductDetails } from './product-details'

/**
 * Тело деталей товара (этап 0): модалка карточки и fallback /product/[id].
 * Действие addToCart замокано алиасом (.storybook/mocks/cart-actions).
 */
const meta = {
	title: 'Shop/ProductDetails',
	component: ProductDetails,
} satisfies Meta<typeof ProductDetails>
export default meta
type Story = StoryObj<typeof meta>

/** Товар: emoji-фолбэк (imageSrc=null), степпер, «В корзину» с выбранным qty */
export const Single: Story = { args: { product: margherita } }

/** Сет: состав из setComponents + зачёркнутая старая цена (830 ₽ → 690 ₽) */
export const SetProduct: Story = { args: { product: shawarmaForTwo } }

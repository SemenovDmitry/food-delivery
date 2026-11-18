import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { margherita, shawarmaForTwo } from './fixtures'
import { ProductCard } from './product-card'

/**
 * Карточка каталога: emoji-фолбэк (imageUrl null — канон сидера), модалка
 * товара по клику (?product=<id>, §5.22). Action корзины замокан алиасом
 * (.storybook/mocks) — клик по «В корзину» показывает тост успеха.
 */
const meta = {
	title: 'Shop/ProductCard',
	component: ProductCard,
} satisfies Meta<typeof ProductCard>
export default meta
type Story = StoryObj<typeof meta>

export const SingleProduct: Story = { args: { product: margherita } }

/** Сет: состав в подписи + зачёркнутая старая цена */
export const SetWithComponents: Story = { args: { product: shawarmaForTwo } }

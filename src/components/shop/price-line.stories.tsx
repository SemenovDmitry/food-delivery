import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PriceLine } from './price-line'

/** Цена + зачёркнутая старая + бейдж выгоды (§11) */
const meta = {
	title: 'Shop/PriceLine',
	component: PriceLine,
} satisfies Meta<typeof PriceLine>
export default meta
type Story = StoryObj<typeof meta>

/** Просто цена (590 ₽) */
export const Plain: Story = { args: { price: 59000 } }

/** Сет: зачёркнутая старая + выгода (690 против 830 ₽) */
export const WithOldPrice: Story = { args: { price: 69000, oldPrice: 83000 } }

/** Крупный размер — модалка/страница товара */
export const Large: Story = { args: { price: 69000, oldPrice: 83000, large: true } }

/** oldPrice равен цене — выгода не показывается */
export const NoSaving: Story = { args: { price: 59000, oldPrice: 59000 } }

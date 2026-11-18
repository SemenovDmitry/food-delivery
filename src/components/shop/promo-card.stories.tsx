import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { promoNoCode, promoShawarma, promoUnlimited } from './fixtures'
import { PromoCard } from './promo-card'

/** Карточка акции на /promo и ленте главной — публичные (без кнопок) */
const meta = {
	title: 'Shop/PromoCard',
	component: PromoCard,
} satisfies Meta<typeof PromoCard>
export default meta
type Story = StoryObj<typeof meta>

/** Процентная с кодом и окном (SHAWARMA20) */
export const PercentWithCode: Story = { args: { promo: promoShawarma } }

/** Фиксированная без кода */
export const FixedNoCode: Story = { args: { promo: promoNoCode } }

/** Бессрочная (endsAt null) */
export const Unlimited: Story = { args: { promo: promoUnlimited } }

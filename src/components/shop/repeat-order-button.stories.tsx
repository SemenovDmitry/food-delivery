import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { RepeatOrderButton } from './repeat-order-button'

/**
 * «Повторить заказ» над карточкой квитанции (2026-11-16): repeatOrder замокан
 * алиасом (.storybook/mocks/order-actions, успех «2 поз.» → тост + /cart).
 * Ошибка/«0 позиций» — тосты, покрыты e2e P2.
 */
const meta = {
	title: 'Shop/RepeatOrderButton',
	component: RepeatOrderButton,
	args: { orderId: '68dbbfbd-1111-2222-3333-444444444444' },
} satisfies Meta<typeof RepeatOrderButton>
export default meta
type Story = StoryObj<typeof meta>

/** Idle: иконка-спиннер меняется на Loader2 на время перехода */
export const Default: Story = {}

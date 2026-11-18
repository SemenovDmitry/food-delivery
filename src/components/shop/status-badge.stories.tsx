import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { ORDER_STATUSES } from '@/db/schema'
import { StatusBadge } from './status-badge'

/**
 * Цветной статус (4-бис): токены --status-info/progress/success, отмены —
 * destructive; текст внутри бейджа — цвет не единственный носитель смысла (§7).
 * По одной стори на каждый статус — сверка цветов в обеих темах toolbar'ом.
 */
const meta = {
	title: 'Shop/StatusBadge',
	component: StatusBadge,
} satisfies Meta<typeof StatusBadge>
export default meta
type Story = StoryObj<typeof meta>

const byStatus = (status: (typeof ORDER_STATUSES)[number]) => ({ args: { status } })

export const Created: Story = byStatus('created')
export const Preparing: Story = byStatus('preparing')
export const Ready: Story = byStatus('ready')
export const InDelivery: Story = byStatus('in_delivery')
export const Delivered: Story = byStatus('delivered')
export const PickedUp: Story = byStatus('picked_up')
export const CancelledByCustomer: Story = byStatus('cancelled_by_customer')
export const CancelledByVendor: Story = byStatus('cancelled_by_vendor')
export const CancelledByTimeout: Story = byStatus('cancelled_by_timeout')

/** Кривое значение из text-колонки — outline без кастомных цветов (ревью S7) */
export const InvalidValue: Story = { args: { status: 'несуществующий' } }

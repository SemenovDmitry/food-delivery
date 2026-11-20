import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PerPageSelect } from './per-page-select'

/**
 * Селектор per-page пагинации (этап 5, Q19/Q27): смена пишет URL через
 * мок-роутер preview ([sb-router] push в консоль). Параметры приходят
 * пропсами — useSearchParams компонент не читает (§5.30-семья).
 */
const meta = {
	title: 'Admin/PerPageSelect',
	component: PerPageSelect,
} satisfies Meta<typeof PerPageSelect>
export default meta
type Story = StoryObj<typeof meta>

/** Канон /admin/orders: 10 на странице, без фильтров */
export const Default: Story = { args: { base: '/admin/orders', perPage: 10 } }

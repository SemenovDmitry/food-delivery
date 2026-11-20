import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ProductsReorder } from './products-reorder'

/**
 * DnD-сортировка товаров категории (этап 5, Q26/Q27): reorderProducts замокан
 * алиасом (.storybook/mocks/products-actions — успех). Строка 3 показывает оба
 * бейджа (Сет + Скрыт).
 */
const meta = {
	title: 'Admin/ProductsReorder',
	component: ProductsReorder,
	args: { categoryId: 2, categoryName: 'Шаурма' },
} satisfies Meta<typeof ProductsReorder>
export default meta
type Story = StoryObj<typeof meta>

/** Шаурма: 3 товара, у третьего бейджи «Сет» и «Скрыт» */
export const List: Story = {
	args: {
		items: [
			{
				id: '44444444-4444-4444-4444-444444444444',
				name: 'Классическая',
				emoji: '🌯',
				price: 34000,
				type: 'single',
				isActive: true,
			},
			{
				id: '66666666-6666-6666-6666-666666666666',
				name: 'Острая',
				emoji: '🌶️',
				price: 38000,
				type: 'single',
				isActive: true,
			},
			{
				id: '22222222-2222-2222-2222-222222222222',
				name: 'Шаурма для двоих',
				emoji: '🌯',
				price: 69000,
				type: 'set',
				isActive: false,
			},
		],
	},
}

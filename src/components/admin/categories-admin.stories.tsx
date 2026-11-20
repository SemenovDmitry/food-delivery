import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { AdminCategoryRow } from '@/queries/categories'
import { CategoriesAdmin } from './categories-admin'

/**
 * Управление категориями (этап 5, Q17/Q25/Q27): весь список с DnD, create/edit
 * и delete — Dialog'и (интеракция). Actions замоканы алиасами
 * (.storybook/mocks/categories-actions, тикет 05): reorder — успех «Порядок
 * сохранён», delete — успех (гвард «в категории N товаров» — прод-путь).
 */
const meta = {
	title: 'Admin/CategoriesAdmin',
	component: CategoriesAdmin,
} satisfies Meta<typeof CategoriesAdmin>
export default meta
type Story = StoryObj<typeof meta>

/** 5 категорий сидера: slug-якоря + счётчики товаров */
export const List: Story = {
	args: {
		categories: [
			{ id: 1, slug: 'pizza', name: 'Пицца', position: 1, productCount: 8 },
			{ id: 2, slug: 'shawarma', name: 'Шаурма', position: 2, productCount: 6 },
			{ id: 3, slug: 'sets', name: 'Сеты', position: 3, productCount: 3 },
			{ id: 4, slug: 'drinks', name: 'Напитки', position: 4, productCount: 4 },
			{ id: 5, slug: 'desserts', name: 'Десерты', position: 5, productCount: 3 },
		] satisfies AdminCategoryRow[],
	},
}
